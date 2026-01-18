# Nexhacks - Assistive Communication Interface

An assistive communication system that enables users to communicate through biosignal gestures. The system uses AI-powered word prediction, real-time signal processing, and voice synthesis to help users build and speak sentences naturally.

---

## How We Use APIs for Compound Insights (150 Words)

Our system creates a **compound AI pipeline** by chaining three specialized APIs to transform raw biosignals into natural speech.

**WoodWide AI** serves as our biosignal intelligence layer. We upload labeled EMG data collected from OpenBCI hardware to train a Prediction model that classifies gestures with high accuracy. WoodWide's numeric reasoning eliminates false positives from noisy sensor data by learning semantic patterns rather than relying on brittle thresholds. This gives us production-ready biosignal detection without building custom ML infrastructure.

**ElevenLabs** powers our voice pipeline. We clone the user's biological voice from a 10-second sample, then synthesize their constructed sentences in real-time. The transcription service captures conversation context, feeding it to our word prediction engine for contextually relevant suggestions.

**OpenRouter (Gemini 2.0 Flash)** generates intelligent word predictions based on partial sentences and conversation context, enabling users to communicate faster with fewer selections.

Together, these APIs create a seamless biosignal-to-speech experience.

---

## Features

- **Biosignal Navigation**: Control the interface using biosignal inputs (single signal = move right, double signal = move down, hold = select)
- **AI-Powered Word Prediction**: Context-aware word suggestions using Google Gemini 2.0 Flash
- **Voice Cloning**: Synthesize speech using the user's own cloned voice
- **Real-Time Transcription**: Transcribe conversation partners for context-aware responses
- **Signal Processing**: Advanced EMG signal filtering and noise reduction

## Required API Keys

You will need the following API keys to run this application:

| Service | Key Name | Purpose | Get it from |
|---------|----------|---------|-------------|
| OpenRouter | `OPENROUTER_API_KEY` | AI word prediction (Gemini 2.0 Flash) | [openrouter.ai](https://openrouter.ai/) |
| ElevenLabs | `ELEVEN_API_KEY` | Text-to-speech & voice cloning | [elevenlabs.io](https://elevenlabs.io/) |
| WoodWide AI | `WOODWIDE_API_KEY` | Biosignal prediction model | [woodwide.ai](https://woodwide.ai/) |

## Project Structure

```
Nexhacks/
├── backend/                 # FastAPI Python backend (port 8000)
│   ├── main.py             # Main API endpoints
│   ├── config.py           # Configuration and API keys
│   ├── word_generator.py   # AI word prediction logic
│   └── requirements.txt    # Python dependencies
├── frontend/               # React + TypeScript frontend (port 3000)
│   ├── src/
│   │   ├── App.tsx        # Main application component
│   │   ├── components/    # UI components
│   │   └── api/           # API client functions
│   └── package.json       # Node dependencies
├── Signal_Processing/      # EMG signal processing
│   ├── ClenchDetection.py # Biosignal detection via LSL
│   └── TranscriptionService.py # Speech-to-text service
└── docker-compose.yml      # Docker orchestration
```

## Setup Instructions

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn
- (Optional) EEG/EMG hardware with Lab Streaming Layer (LSL) support

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/Nexhacks.git
cd Nexhacks
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env

# Edit .env and add your API keys
# OPENROUTER_API_KEY=sk-or-v1-your-key-here
# ELEVEN_API_KEY=sk_your-key-here
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install
```

### 4. Signal Processing Setup (Optional)

If using EEG/EMG hardware for biosignal detection:

```bash
cd Signal_Processing

# Install additional dependencies
pip install SpeechRecognition pylsl pygame brainflow mne
```

## Running the Application

### Start the Backend

```bash
cd backend
python main.py
# Server starts at http://localhost:8000
```

### Start the Frontend

```bash
cd frontend
npm run dev
# Opens at http://localhost:3000
```

### Start Signal Processing (Optional)

```bash
# For biosignal detection (requires LSL stream)
cd Signal_Processing
python ClenchDetection.py

# For transcription service (listens to microphone)
python TranscriptionService.py
```

### Development Controls

For testing without hardware, use keyboard controls:
- `1` or `Right Arrow`: Move cursor right
- `2` or `Down Arrow`: Move cursor down
- `3`: Refresh word grid
- Wait 800ms on a word: Auto-select

## Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Frontend: http://localhost:3000
# Backend: http://localhost:8000
```

---

## WoodWide AI - Numeric Reasoning for Biosignal Detection

We leverage **[WoodWide AI's Numeric Reasoning API](https://woodwide.ai/)** for biosignal classification, combining **Anomaly Detection** and **Prediction** models to achieve accurate detection from extremely noisy EMG sensor data.

### WoodWide AI: 150-Word Explanation

Our biosignal data from OpenBCI is inherently noisy—especially during double-clench gestures where rapid muscle activations create erratic signal spikes that corrupt training data. WoodWide AI's **Anomaly Detection endpoint** (`POST /api/models/anomaly/train`) identifies these outliers automatically. We upload our raw CSV, train an anomaly model, and run inference to flag corrupted samples. These flagged rows are removed, producing a clean dataset.

With cleaned data, we train a **Prediction model** (`POST /api/models/prediction/train`) for binary classification (biosignal detected vs. not). WoodWide's numeric reasoning learns semantic patterns from our labeled data, producing accurate and interpretable outputs without manual threshold tuning.

This two-stage pipeline—anomaly detection for data cleaning, then prediction for classification—lets us focus on user experience rather than ML infrastructure. WoodWide's API-first design and reusable representation layer eliminate the need for custom model building or constant retuning as conditions change.

---

### Our Two-Model Approach

WoodWide AI offers four model types: **Predict**, **Cluster**, **Anomaly**, and **Embedding**. We use **two** of them in sequence:

| Model Type | How We Use It |
|------------|---------------|
| **Anomaly** | Clean our dataset by detecting and removing outlier samples |
| **Predict** | Classify biosignals after data has been cleaned |

### The Double-Clench Noise Problem

Double-clench gestures are critical for our interface (they trigger "move down" navigation), but they produce extremely noisy signals:

- **Rapid muscle contractions** create overlapping EMG spikes
- **Signal amplitude swings wildly** between the two clenches
- **Electrode saturation** causes clipping artifacts
- **Motion artifacts** from jaw movement corrupt readings

Training a classifier on this raw data produces unreliable results. We needed to clean the dataset first.

### Stage 1: Anomaly Detection for Data Cleaning

We use WoodWide's **Anomaly Detection** endpoint to identify corrupted samples:

```
1. POST /api/datasets                    → Upload raw OpenBCI CSV
2. POST /api/models/anomaly/train        → Train anomaly detector
3. GET  /api/models/{id}                 → Poll until COMPLETE
4. POST /api/models/anomaly/{id}/infer   → Get anomaly scores per row
5. Filter out rows with high anomaly scores
```

The anomaly model learns the normal distribution of our biosignal features and flags samples that deviate significantly—exactly the corrupted double-clench data we need to remove.

### Stage 2: Prediction on Cleaned Data

With outliers removed, we train a **Prediction model** on the cleaned dataset:

```
1. POST /api/datasets                      → Upload cleaned CSV
2. POST /api/models/prediction/train       → Train classifier
3. GET  /api/models/{id}                   → Poll until COMPLETE
4. POST /api/models/prediction/{id}/infer  → Classify new signals
```

The prediction model now trains on high-quality data, producing **accurate, interpretable, and dependable** outputs.

### Why This Approach Works

| Challenge | WoodWide Solution |
|-----------|-------------------|
| Noisy double-clench data | Anomaly detection removes corrupted samples |
| False positives | Prediction model learns true signal patterns |
| Manual threshold tuning | Semantic reasoning adapts automatically |
| Custom ML infrastructure | API-first design—no models to build |
| Changing conditions | Reusable representation layer handles drift |

### Integration Code

```python
# Two-stage WoodWide AI pipeline

client = WoodWideClient(api_key=WOODWIDE_API_KEY)

# === STAGE 1: ANOMALY DETECTION ===
# Upload raw noisy data
raw_dataset_id = client.upload_dataset("raw_openbci_data.csv", "raw_signals")

# Train anomaly detector
anomaly_model_id = client.train_anomaly_model("signal_anomaly_detector")
client.wait_for_training()

# Get anomaly scores
anomaly_results = client.detect_anomalies(raw_dataset_id)

# Remove outliers (especially noisy double-clench samples)
clean_data = remove_flagged_rows(raw_data, anomaly_results)
clean_data.to_csv("cleaned_signals.csv")

# === STAGE 2: PREDICTION ===
# Upload cleaned data
clean_dataset_id = client.upload_dataset("cleaned_signals.csv", "clean_signals")

# Train prediction model
predict_model_id = client.train_model("biosignal_classifier", label_column="is_signal")
client.wait_for_training()

# Run inference on new data
predictions = client.predict(inference_dataset_id)
```

---

## Dataset Documentation

### Source: OpenBCI Live Signals

Our training dataset was collected from **live OpenBCI biosignal recordings**, capturing real EMG activity during controlled sessions.

#### Data Collection Setup
- **Hardware**: OpenBCI Cyton board with EMG electrodes
- **Placement**: Electrodes positioned on the masseter muscle group
- **Protocol**: Participants performed controlled biosignal gestures with rest periods
- **Streaming**: Data streamed via Lab Streaming Layer (LSL) protocol

#### Dataset Schema

| Column | Type | Description |
|--------|------|-------------|
| `timestamp` | float | Unix timestamp of sample |
| `rms` | float | Root Mean Square of signal amplitude |
| `is_clench` | int (0/1) | Ground truth label (1 = biosignal detected) |

#### Preprocessing Pipeline

Before uploading to WoodWide AI:
1. **Low-pass filtering** at 500Hz to remove high-frequency noise
2. **Reference signal subtraction** to eliminate common-mode artifacts
3. **RMS feature extraction** over sliding windows
4. **Manual labeling** of biosignal events for supervised training

The preprocessed CSV is then uploaded to WoodWide AI for model training, allowing the Reasoning API to learn patterns that generalize beyond simple threshold detection

---

## ElevenLabs - Voice & Audio Pipeline

**ElevenLabs** serves as the audio foundation for our communication system, providing both speech recognition and synthesis capabilities.

### Speech-to-Text (Real-Time Transcription)

The transcription service captures and processes audio from conversation partners:

- **Real-time transcription** of incoming speech with low latency
- **Context-aware response prediction**: Transcribed text is fed to our word prediction engine, enabling the system to suggest contextually relevant responses
- **Speaker identification** for multi-person conversations
- **Noise-robust recognition** using clinical-grade audio processing

### Voice Cloning

ElevenLabs enables users to speak in their own biological voice:

- **Instant voice cloning** from just a 10-second audio sample
- **Emotional nuance preservation**: The cloned voice maintains the user's natural speech patterns, intonation, and emotional expression
- **Real-time synthesis**: Generated speech plays immediately as sentences are constructed

### Audio Quality

We prioritize clinical-grade audio clarity:

- **High-fidelity voice output** ensures natural, human-like speech
- **Emotional authenticity** preserves the subtle nuances that make communication personal
- **Adaptive volume and pacing** for different listening environments

### Integration Flow

```
User's Voice Sample (10s) ──> ElevenLabs Voice Clone
                                      │
Conversation Partner ──> Speech-to-Text ──> Word Prediction Engine
                                                      │
                              Selected Words ──> Text-to-Speech ──> Cloned Voice Output
```

---

## API Endpoints

### Word Generation
- `POST /api/words` - Generate contextual word predictions
- `POST /api/refresh` - Refresh word grid

### Voice & Speech
- `POST /api/clone-voice` - Clone voice from audio sample
- `POST /api/text-to-speech` - Convert text to speech
- `POST /api/speak-sentence` - Speak completed sentence

### Signals & Transcription
- `POST /api/signal` - Receive biosignal events
- `WebSocket /ws/signals` - Real-time signal streaming
- `WebSocket /ws/transcription` - Real-time transcription streaming

## Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Required
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key
ELEVEN_API_KEY=sk_your-elevenlabs-key
WOODWIDE_API_KEY=your-woodwide-api-key

# Optional (defaults shown)
OPENROUTER_MODEL=google/gemini-2.0-flash-001
```

## Troubleshooting

### Backend won't start
- Ensure all dependencies are installed: `pip install -r requirements.txt`
- Check that API keys are set in `.env`
- Verify port 8000 is not in use

### No word predictions
- Verify `OPENROUTER_API_KEY` is valid
- Check backend logs for API errors

### Voice cloning not working
- Verify `ELEVEN_API_KEY` is valid
- Ensure audio sample is at least 10 seconds
- Check ElevenLabs account has available credits

### Signal processing issues
- Verify LSL stream is active and discoverable
- Adjust threshold values in `ClenchDetection.py`
- Check electrode placement and signal quality

## License

MIT License

## Acknowledgments

- **WoodWide AI** for signal processing and reasoning capabilities
- **ElevenLabs** for voice cloning and speech synthesis
- **OpenRouter** for LLM API access
- Built at NexHacks 2025
