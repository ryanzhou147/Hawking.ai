"""
Ultra-Lightweight Transcription Service
Fully threaded and non-blocking - will NOT freeze your system.
"""

import threading
import queue
import requests
import time
import sys

# Try to import speech recognition
try:
    import speech_recognition as sr
    SR_AVAILABLE = True
except ImportError:
    SR_AVAILABLE = False
    print("speech_recognition not installed. Run: pip install SpeechRecognition")

# Backend API endpoint
API_URL = "http://127.0.0.1:8000/api/transcription"

# Lightweight settings
PHRASE_TIME_LIMIT = 5  # Max 5 seconds per phrase
PAUSE_THRESHOLD = 0.5  # Quick pause detection
SAMPLE_RATE = 16000    # Lower sample rate = less CPU

# Thread-safe queue for transcriptions
transcription_queue = queue.Queue()
running = True


def send_to_backend(text, speaker="Someone"):
    """Send transcription to backend (non-blocking)"""
    try:
        requests.post(API_URL, json={
            "text": text,
            "speaker": speaker,
            "timestamp": time.time()
        }, timeout=0.5)
    except:
        pass  # Silently fail - don't block


def sender_thread():
    """Background thread that sends transcriptions to backend"""
    while running:
        try:
            text = transcription_queue.get(timeout=1)
            if text:
                send_to_backend(text)
                print(f"-> {text}")
        except queue.Empty:
            continue
        except:
            pass


def listener_thread():
    """Background thread that listens to microphone"""
    global running

    if not SR_AVAILABLE:
        print("Speech recognition not available")
        return

    recognizer = sr.Recognizer()
    recognizer.pause_threshold = PAUSE_THRESHOLD
    recognizer.energy_threshold = 300
    recognizer.dynamic_energy_threshold = False  # Disable for lower CPU

    try:
        mic = sr.Microphone(sample_rate=SAMPLE_RATE)
    except Exception as e:
        print(f"Microphone error: {e}")
        return

    # Quick ambient noise calibration
    print("Calibrating... (1 second)")
    with mic as source:
        recognizer.adjust_for_ambient_noise(source, duration=1)
    print(f"Ready. Threshold: {recognizer.energy_threshold:.0f}")
    print("-" * 40)

    while running:
        try:
            with mic as source:
                # Non-blocking listen with short timeout
                try:
                    audio = recognizer.listen(source, timeout=2, phrase_time_limit=PHRASE_TIME_LIMIT)
                except sr.WaitTimeoutError:
                    continue  # No speech, keep listening

            # Transcribe in a separate operation
            try:
                text = recognizer.recognize_google(audio, language="en-US")
                if text and text.strip():
                    transcription_queue.put(text.strip())
            except sr.UnknownValueError:
                pass  # Couldn't understand
            except sr.RequestError:
                time.sleep(0.5)  # API error, brief pause

        except Exception as e:
            time.sleep(0.1)
            continue


def main():
    global running

    print("=" * 40)
    print("Lightweight Transcription Service")
    print("=" * 40)
    print("Press Ctrl+C to stop\n")

    # Start background threads
    sender = threading.Thread(target=sender_thread, daemon=True)
    listener = threading.Thread(target=listener_thread, daemon=True)

    sender.start()
    listener.start()

    # Keep main thread alive
    try:
        while True:
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nStopping...")
        running = False
        time.sleep(0.5)
        print("Stopped.")


if __name__ == "__main__":
    main()
