from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from elevenlabs import ElevenLabs
import io
import asyncio
import json
import os
from typing import List

# Connection manager to handle multiple WebSocket clients
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    
    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass

manager = ConnectionManager()

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

@app.websocket("/ws/bci")
async def bci_commands(websocket: WebSocket):
    """
    Receives BCI commands and broadcasts to all frontend clients
    """
    await websocket.accept()
    print("BCI hardware connected")
    
    try:
        while True:
            data = await websocket.receive_text()
            command_data = json.loads(data)
            
            command = command_data.get("command")
            print(f"BCI Command: {command}")
            
            # Broadcast to all connected frontends
            await manager.broadcast(json.dumps({
                "action": command,
                "timestamp": command_data.get("timestamp")
            }))
            
    except WebSocketDisconnect:
        print("BCI hardware disconnected")


@app.websocket("/ws/frontend")
async def frontend_connection(websocket: WebSocket):
    """
    Frontend connects here to receive BCI commands
    """
    await manager.connect(websocket)
    print("Frontend connected")
    
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Frontend disconnected")

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

@app.websocket("/ws/bci")
async def bci_commands(websocket: WebSocket):
    """
    WebSocket endpoint to receive BCI commands from hardware team
    and forward to frontend
    """
    await websocket.accept()
    print("BCI client connected")
    
    try:
        while True:
            # Receive command from BCI hardware team
            data = await websocket.receive_text()
            command_data = json.loads(data)
            
            command = command_data.get("command")  # "right", "down", or "select"
            
            print(f"BCI Command received: {command}")
            
            # Forward command to frontend
            await websocket.send_text(json.dumps({
                "action": command,
                "timestamp": command_data.get("timestamp", None)
            }))
            
    except WebSocketDisconnect:
        print("BCI client disconnected")
    except Exception as e:
        print(f"BCI WebSocket error: {e}")
        await websocket.close()