from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from elevenlabs import ElevenLabs
import io
import asyncio
import json
import os

app = FastAPI()

# Allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ElevenLabs client
# You'll add your API key here
ELEVENLABS_API_KEY = "sk_30b0db719231579fe0bf060a65a80499fa6a780071f903b4"
client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

@app.get("/")
def read_root():
    return {"status": "NexHacks Transcription Service Running"}

@app.websocket("/ws/transcribe")
async def transcribe_audio(websocket: WebSocket):
    await websocket.accept()
    print("Client connected for transcription")
    
    try:
        # Use ElevenLabs Speech-to-Text streaming
        async with client.speech_to_text.realtime() as stt:
            
            async def send_audio():
                # Receive audio from frontend and send to ElevenLabs
                try:
                    while True:
                        audio_chunk = await websocket.receive_bytes()
                        await stt.input_stream.send(audio_chunk)
                except WebSocketDisconnect:
                    await stt.input_stream.close()
            
            async def receive_transcripts():
                # Receive transcripts from ElevenLabs and send to frontend
                async for transcript in stt.output_stream:
                    if transcript.text:
                        print(f"Transcribed: {transcript.text}")
                        await websocket.send_text(json.dumps({
                            "text": transcript.text,
                            "is_final": transcript.is_final
                        }))
            
            # Run both tasks concurrently
            import asyncio
            await asyncio.gather(send_audio(), receive_transcripts())
            
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")
        await websocket.close()

@app.post("/clone-voice")
async def clone_voice(name: str, audio_file: UploadFile = File(...)):
    """
    Upload audio sample to clone user's voice
    Returns voice_id to use for TTS
    """
    try:
        # Read the uploaded audio file
        audio_bytes = await audio_file.read()
        
        # Create a voice clone with ElevenLabs
        voice = client.voices.clone(
            name=name,
            files=[audio_bytes]
        )
        
        print(f"Voice cloned successfully: {voice.voice_id}")
        
        return {
            "status": "success",
            "voice_id": voice.voice_id,
            "name": name
        }
        
    except Exception as e:
        print(f"Voice cloning error: {e}")
        return {"status": "error", "message": str(e)}


@app.post("/text-to-speech")
async def text_to_speech(text: str, voice_id: str):
    """
    Convert text to speech using cloned voice
    Returns audio as bytes
    """
    try:
        from fastapi.responses import StreamingResponse
        import io
        
        # Generate speech using the cloned voice
        audio_generator = client.text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id="eleven_monolingual_v1"
        )
        
        # Collect audio chunks
        audio_bytes = b"".join(audio_generator)
        
        # Return as audio stream
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/mpeg"
        )
        
    except Exception as e:
        print(f"TTS error: {e}")
        return {"status": "error", "message": str(e)}