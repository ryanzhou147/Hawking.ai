
# Jaw-Clench Word Generator Backend

FastAPI backend for contextual word prediction using Gemini Flash via OpenRouter.

## Setup

1. Create a `.env` file in the backend directory:
```bash
cp .env.example .env
```

2. Add your OpenRouter API key to `.env`:
```
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
```

3. Install dependencies:
```bash
pip install -r ../requirements.txt
```

4. Run the server:
```bash
cd backend
python main.py
```

Or with uvicorn directly:
```bash
uvicorn main:app --reload --port 8000
```

## API Endpoints

### `POST /api/words`
Generate 25 contextual words based on chat history.

**Request:**
```json
{
  "chat_history": [
    {"text": "Hello there.", "is_user": true}
  ],
  "current_sentence": ["I", "want"],
  "is_sentence_start": false
}
```

**Response:**
```json
{
  "words": ["to", "a", "the", "some", "more", ...],
  "cached_words": ["something", "help", "food", ...]
}
```

### `POST /api/refresh`
Swap cached words into display and generate new cache.

### `GET /api/health`
Health check endpoint.

## Word Generation Logic

1. **Sentence Start (no context):** Returns common sentence starters (I, The, What, etc.)
2. **Sentence Start (with context):** Uses Gemini to predict likely starters based on conversation
3. **Continuing Sentence:** Predicts next words based on current sentence and chat history
4. **Words are ordered by likelihood:** Index 0 = most likely, displayed top-left in grid

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key |
