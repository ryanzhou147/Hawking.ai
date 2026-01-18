from fastapi import FastAPI, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from models import WordRequest, WordResponse, RefreshRequest, ResetBranchRequest
from word_generator import word_generator
from pydantic import BaseModel
from elevenlabs import ElevenLabs
import asyncio
import json
import io
import base64
import os

connected_clients: list[WebSocket] = []

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "sk_30b0db719231579fe0bf060a65a80499fa6a780071f903b4")
elevenlabs_client: ElevenLabs | None = None

current_voice_id: str | None = None

class SignalRequest(BaseModel):
    action: str  # "RIGHT", "DOWN", or "SELECT"
    timestamp: float | None = None

class TTSRequest(BaseModel):
    text: str
    voice_id: str | None = None

class TranscriptionRequest(BaseModel):
    text: str
    speaker: str = "Other Person"
    timestamp: float | None = None

# Store connected transcription clients (frontends listening for other people's speech)
transcription_clients: list[WebSocket] = []

@asynccontextmanager
async def lifespan(app: FastAPI):
    global elevenlabs_client, current_voice_id

    # Startup - initialize OpenRouter client
    print("Starting up - initializing OpenRouter client...")
    word_generator.load_model()
    print("OpenRouter client ready!")

    print("Initializing ElevenLabs client...")
    elevenlabs_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
    print("ElevenLabs client ready!")

    try:
        voices = elevenlabs_client.voices.get_all()
        voice_id = None
        if hasattr(voices, "voices") and voices.voices:
            voice_id = voices.voices[0].voice_id
        elif isinstance(voices, list) and len(voices) > 0:
            voice_id = voices[0].voice_id
        if voice_id:
            current_voice_id = voice_id
            print(f"Default ElevenLabs voice set to: {current_voice_id}")
        else:
            print("No ElevenLabs voices found; TTS will require explicit voice_id.")
    except Exception as e:
        print(f"Failed to load default ElevenLabs voice: {e}")

    yield

    # Shutdown
    await word_generator.close()

app = FastAPI(
    title="Jaw-Clench Word Generator API",
    description="Backend API for generating contextual word predictions",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Jaw-Clench Word Generator API", "status": "running"}

@app.post("/api/words", response_model=WordResponse)
async def get_words(request: WordRequest):
    """
    Generate 24 contextual words based on chat history and current sentence.
    Returns both display words and cached words (different sets, no duplicates).
    Words are ordered by likelihood (index 0 = most likely).
    """
    try:
        display_words, cached_words, duration_ms = await word_generator.generate_initial_words(
            chat_history=request.chat_history,
            current_sentence=request.current_sentence,
            is_sentence_start=request.is_sentence_start
        )
        return WordResponse(
            words=display_words, 
            cached_words=cached_words, 
            two_step_time_ms=duration_ms
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/refresh", response_model=WordResponse)
async def refresh_words(request: RefreshRequest, background_tasks: BackgroundTasks):
    """
    Generate new words excluding previously shown words in this layer.
    Each refresh shows completely different words until a word is selected.
    """
    try:
        display_words, _, duration_ms = await word_generator.generate_initial_words(
            chat_history=request.chat_history,
            current_sentence=request.current_sentence,
            is_sentence_start=request.is_sentence_start,
            is_refresh=True  # Don't clear tracking, just add to exclusions
        )

        return WordResponse(
            words=display_words,
            cached_words=[],
            two_step_time_ms=duration_ms
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-cache")
async def generate_cache(request: WordRequest):
    """
    Generate new cache in background. Called by frontend while user navigates.
    """
    try:
        cache_words = await word_generator.generate_cache_background(
            chat_history=request.chat_history,
            current_sentence=request.current_sentence,
            is_sentence_start=request.is_sentence_start
        )
        return {"cached_words": cache_words, "status": "generated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cache")
async def get_cache():
    """Get current cached words without regenerating."""
    return {
        "cached_words": word_generator.get_cached_words(),
        "used_words": word_generator.get_used_words()
    }

@app.post("/api/clear-used")
async def clear_used_words():
    """Clear used words tracking (called when starting new sentence)."""
    word_generator.clear_used_words()
    return {"status": "cleared"}

@app.post("/api/reset-branch")
async def reset_branch(request: ResetBranchRequest):
    try:
        words = await word_generator.reset_two_step_branch(
            chat_history=request.chat_history,
            current_sentence=request.current_sentence,
            is_sentence_start=request.is_sentence_start,
            first_word=request.first_word
        )
        return {"words": words}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": word_generator.is_loaded
    }


# ============ SIGNAL HANDLING (for ClenchDetection.py) ============

@app.websocket("/ws/signals")
async def websocket_signals(websocket: WebSocket):
    """WebSocket endpoint for frontend to receive signals from ClenchDetection.py"""
    await websocket.accept()
    connected_clients.append(websocket)
    print(f"WebSocket client connected. Total clients: {len(connected_clients)}")
    try:
        while True:
            # Keep connection alive, wait for messages (ping/pong)
            data = await websocket.receive_text()
            # Echo back for keepalive
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
        print(f"WebSocket client disconnected. Total clients: {len(connected_clients)}")


@app.post("/api/signal")
async def receive_signal(request: SignalRequest):
    """
    Receive signals from ClenchDetection.py and broadcast to all connected frontends.
    Actions: RIGHT, DOWN, SELECT
    """
    action = request.action.upper()
    print(f"Received signal: {action}")

    # Broadcast to all connected WebSocket clients
    disconnected = []
    for client in connected_clients:
        try:
            await client.send_text(json.dumps({"action": action, "timestamp": request.timestamp}))
        except Exception as e:
            print(f"Failed to send to client: {e}")
            disconnected.append(client)

    # Clean up disconnected clients
    for client in disconnected:
        if client in connected_clients:
            connected_clients.remove(client)

    return {"status": "ok", "action": action, "clients_notified": len(connected_clients)}


# Also support the /api/process endpoint that ClenchDetection.py currently uses
@app.post("/api/process")
async def process_signal(request: SignalRequest):
    """Alias for /api/signal - maintains compatibility with ClenchDetection.py"""
    return await receive_signal(request)


# ============ ELEVENLABS TEXT-TO-SPEECH ============

@app.post("/api/clone-voice")
async def clone_voice(name: str = Form(...), audio_file: UploadFile = File(...)):
    """
    Upload audio sample to clone user's voice.
    Returns voice_id to use for TTS.
    """
    global current_voice_id

    if not elevenlabs_client:
        raise HTTPException(status_code=500, detail="ElevenLabs client not initialized")

    try:
        audio_bytes = await audio_file.read()
        buffer = io.BytesIO(audio_bytes)
        buffer.name = audio_file.filename or f"{name}.mp3"

        voice = elevenlabs_client.voices.ivc.create(
            name=name,
            files=[buffer]
        )

        print(f"Voice cloned successfully: {voice.voice_id}")

        current_voice_id = voice.voice_id

        return {
            "status": "success",
            "voice_id": voice.voice_id,
            "name": name
        }

    except Exception as e:
        print(f"Voice cloning error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/set-voice")
async def set_voice(voice_id: str):
    """Set the active voice for TTS."""
    global current_voice_id
    current_voice_id = voice_id
    print(f"Active voice set to: {voice_id}")
    return {"status": "success", "voice_id": voice_id}


@app.get("/api/get-voice")
async def get_voice():
    """Get the current active voice_id."""
    return {"voice_id": current_voice_id}


@app.post("/api/text-to-speech")
async def text_to_speech(request: TTSRequest):
    """
    Convert text to speech using cloned voice.
    Returns audio as streaming response.
    """
    if not elevenlabs_client:
        raise HTTPException(status_code=500, detail="ElevenLabs client not initialized")

    voice_id = request.voice_id or current_voice_id
    if not voice_id:
        raise HTTPException(status_code=400, detail="No voice_id provided or set")

    try:
        print(f"TTS: '{request.text}' with voice_id: {voice_id}")

        audio_generator = elevenlabs_client.text_to_speech.convert(
            voice_id=voice_id,
            text=request.text,
            model_id="eleven_monolingual_v1"
        )

        audio_bytes = b"".join(audio_generator)

        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=speech.mp3"}
        )

    except Exception as e:
        print(f"TTS error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/speak-sentence")
async def speak_sentence(request: TTSRequest):
    """
    Speak a completed sentence using the cloned voice.
    Called when user finishes building a sentence.
    """
    return await text_to_speech(request)


# ============ TRANSCRIPTION (Listen to others) ============

@app.websocket("/ws/transcription")
async def transcription_websocket(websocket: WebSocket):
    """
    WebSocket for receiving real-time transcription of other people's speech.
    Frontend connects here to receive transcribed text as chat messages.
    """
    await websocket.accept()
    transcription_clients.append(websocket)
    print(f"Transcription client connected. Total: {len(transcription_clients)}")

    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        if websocket in transcription_clients:
            transcription_clients.remove(websocket)
        print(f"Transcription client disconnected. Total: {len(transcription_clients)}")


@app.post("/api/transcription")
async def receive_transcription(request: TranscriptionRequest):
    """
    Receive transcribed speech from microphone and broadcast to all frontends.
    This adds messages from 'other people' to the chat.
    """
    print(f"Transcription received from '{request.speaker}': {request.text}")

    # Broadcast to all connected transcription clients
    message = json.dumps({
        "type": "transcription",
        "text": request.text,
        "speaker": request.speaker,
        "timestamp": request.timestamp,
        "isUser": False
    })

    disconnected = []
    for client in transcription_clients:
        try:
            await client.send_text(message)
        except Exception as e:
            print(f"Failed to send transcription: {e}")
            disconnected.append(client)

    for client in disconnected:
        if client in transcription_clients:
            transcription_clients.remove(client)

    return {"status": "ok", "clients_notified": len(transcription_clients)}


@app.websocket("/ws/speak")
async def speak_websocket(websocket: WebSocket):
    """
    WebSocket for real-time TTS.
    Receives: {"text": "sentence", "voice_id": "optional"}
    Returns: {"audio": "base64_audio", "text": "sentence"}
    """
    await websocket.accept()
    print("Speech WebSocket client connected")

    try:
        while True:
            data = await websocket.receive_text()
            sentence_data = json.loads(data)

            text = sentence_data.get("text")
            voice_id = sentence_data.get("voice_id") or current_voice_id

            if not voice_id:
                await websocket.send_text(json.dumps({"error": "No voice_id set"}))
                continue

            if not text:
                await websocket.send_text(json.dumps({"error": "No text provided"}))
                continue

            print(f"Speaking via WebSocket: '{text}'")

            try:
                audio_generator = elevenlabs_client.text_to_speech.convert(
                    voice_id=voice_id,
                    text=text,
                    model_id="eleven_monolingual_v1"
                )

                audio_bytes = b"".join(audio_generator)
                audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')

                await websocket.send_text(json.dumps({
                    "audio": audio_base64,
                    "text": text
                }))

            except Exception as e:
                await websocket.send_text(json.dumps({"error": str(e)}))

    except WebSocketDisconnect:
        print("Speech WebSocket client disconnected")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
