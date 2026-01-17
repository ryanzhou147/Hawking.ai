import httpx
import json
import re
import asyncio
from config import (
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    MODEL,
    DEFAULT_SENTENCE_STARTERS,
    DEFAULT_CONTINUATION_WORDS
)
from models import ChatMessage

WORD_COUNT = 24  # 24 words for grid (1 slot reserved for refresh button)

class WordGenerator:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.cache: list[str] = []
        self.used_words: set[str] = set()  # Track words already shown
        self.is_generating_cache: bool = False
        self.pending_cache_task: asyncio.Task | None = None

    async def close(self):
        if self.pending_cache_task:
            self.pending_cache_task.cancel()
        await self.client.aclose()

    def clear_used_words(self):
        """Clear used words when starting a new sentence."""
        self.used_words.clear()

    def _build_context(self, chat_history: list[ChatMessage], current_sentence: list[str]) -> str:
        """Build context string from chat history and current sentence."""
        context_parts = []

        if chat_history:
            context_parts.append("Previous conversation:")
            for msg in chat_history[-10:]:  # Last 10 messages for context
                speaker = "User" if msg.is_user else "Assistant"
                context_parts.append(f"{speaker}: {msg.text}")

        if current_sentence:
            context_parts.append(f"\nCurrent sentence being built: {' '.join(current_sentence)}")

        return "\n".join(context_parts)

    async def _call_openrouter(self, prompt: str, exclude_words: set[str] | None = None) -> list[str]:
        """Call OpenRouter API with Gemini Flash."""
        exclude_list = ""
        if exclude_words:
            exclude_list = f"\n\nIMPORTANT: Do NOT include any of these words (already used): {', '.join(list(exclude_words)[:50])}"

        try:
            response = await self.client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "Jaw-Clench Interface"
                },
                json={
                    "model": MODEL,
                    "messages": [
                        {
                            "role": "system",
                            "content": f"""You are a word prediction assistant for an AAC (Augmentative and Alternative Communication) device.
Your task is to predict the most likely next words a user might want to say.
Always respond with ONLY a JSON array of exactly {WORD_COUNT} single words, ordered from most likely to least likely.
Words should be common, useful for daily communication, and contextually appropriate.
Include a mix of: verbs, nouns, adjectives, pronouns, and common phrases.
Some words should end with punctuation (. ! ?) to allow sentence completion.
Do not include any explanation, just the JSON array.{exclude_list}"""
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": 0.7,
                    "max_tokens": 500
                }
            )

            if response.status_code != 200:
                print(f"OpenRouter error: {response.status_code} - {response.text}")
                return []

            data = response.json()
            content = data["choices"][0]["message"]["content"]

            # Parse JSON array from response
            match = re.search(r'\[.*?\]', content, re.DOTALL)
            if match:
                words = json.loads(match.group())
                # Filter out excluded words and ensure WORD_COUNT
                words = [str(w).strip() for w in words if w and str(w).strip().lower() not in (exclude_words or set())]
                return words[:WORD_COUNT]

            return []

        except Exception as e:
            print(f"Error calling OpenRouter: {e}")
            return []

    def _filter_used_words(self, words: list[str]) -> list[str]:
        """Filter out already used words."""
        return [w for w in words if w.lower() not in self.used_words]

    def _pad_words(self, words: list[str], is_sentence_start: bool, exclude: set[str] | None = None) -> list[str]:
        """Ensure we have exactly WORD_COUNT words, excluding already used ones."""
        defaults = DEFAULT_SENTENCE_STARTERS if is_sentence_start else DEFAULT_CONTINUATION_WORDS
        exclude = exclude or set()

        # Remove duplicates while preserving order
        seen = set(exclude)
        unique_words = []
        for w in words:
            w_lower = w.lower()
            if w_lower not in seen:
                seen.add(w_lower)
                unique_words.append(w)

        # Pad with defaults if needed
        for w in defaults:
            if len(unique_words) >= WORD_COUNT:
                break
            w_lower = w.lower()
            if w_lower not in seen:
                seen.add(w_lower)
                unique_words.append(w)

        return unique_words[:WORD_COUNT]

    async def generate_initial_words(
        self,
        chat_history: list[ChatMessage],
        current_sentence: list[str],
        is_sentence_start: bool
    ) -> tuple[list[str], list[str]]:
        """Generate initial 24 words and 24 cached words (different sets)."""

        # Clear used words when starting a new sentence
        if is_sentence_start:
            self.clear_used_words()

        context = self._build_context(chat_history, current_sentence)

        if is_sentence_start:
            if not chat_history:
                # No context - use defaults for display, alternative defaults for cache
                display_words = DEFAULT_SENTENCE_STARTERS[:WORD_COUNT]
                # For cache, use different sentence starters
                cache_words = self._get_alternative_starters(set(w.lower() for w in display_words))
            else:
                # Has context - generate based on conversation
                prompt = f"""Based on this conversation context, predict the {WORD_COUNT} most likely words to START a new sentence.
Order from most likely (first) to least likely (last).

{context}

Respond with ONLY a JSON array of {WORD_COUNT} words."""

                display_words = await self._call_openrouter(prompt)
                if not display_words:
                    display_words = DEFAULT_SENTENCE_STARTERS[:WORD_COUNT]

                display_words = self._pad_words(display_words, is_sentence_start)

                # Generate cache with DIFFERENT words
                cache_prompt = f"""Based on this conversation context, predict the NEXT {WORD_COUNT} most likely words to start a new sentence.
These should be the 25th-48th most likely words (alternatives to the most common ones).
Order from most likely (first) to least likely (last).

{context}

Respond with ONLY a JSON array of {WORD_COUNT} words."""

                cache_words = await self._call_openrouter(cache_prompt, set(w.lower() for w in display_words))
                if not cache_words:
                    cache_words = self._get_alternative_starters(set(w.lower() for w in display_words))
                else:
                    cache_words = self._pad_words(cache_words, is_sentence_start, set(w.lower() for w in display_words))
        else:
            # Continuing a sentence
            prompt = f"""Based on this context, predict the {WORD_COUNT} most likely NEXT words to continue the sentence.
The user is building a sentence word by word. Predict what comes next.
Include some words with ending punctuation (. ! ?) for sentence completion.
Order from most likely (first) to least likely (last).

{context}

Respond with ONLY a JSON array of {WORD_COUNT} words."""

            display_words = await self._call_openrouter(prompt, self.used_words)
            if not display_words:
                display_words = self._filter_used_words(DEFAULT_CONTINUATION_WORDS)[:WORD_COUNT]

            display_words = self._pad_words(display_words, is_sentence_start, self.used_words)

            # Generate cache with DIFFERENT words
            all_exclude = self.used_words | set(w.lower() for w in display_words)
            cache_prompt = f"""Based on this context, predict the NEXT {WORD_COUNT} most likely words to continue the sentence.
These should be alternatives to the most common predictions.
Include some words with ending punctuation (. ! ?) for sentence completion.
Order from most likely (first) to least likely (last).

{context}

Respond with ONLY a JSON array of {WORD_COUNT} words."""

            cache_words = await self._call_openrouter(cache_prompt, all_exclude)
            if not cache_words:
                cache_words = self._filter_used_words(DEFAULT_CONTINUATION_WORDS[WORD_COUNT:])[:WORD_COUNT]

            cache_words = self._pad_words(cache_words, is_sentence_start, all_exclude)

        # Track displayed words as used
        for w in display_words:
            self.used_words.add(w.lower())

        self.cache = cache_words
        return display_words, cache_words

    def _get_alternative_starters(self, exclude: set[str]) -> list[str]:
        """Get alternative sentence starters not in exclude set."""
        alternatives = [
            "Actually", "Maybe", "Perhaps", "Well", "So",
            "Now", "Then", "First", "Also", "But",
            "However", "Although", "Because", "Since", "If",
            "After", "Before", "While", "Until", "Unless",
            "Could", "Should", "Must", "Might", "May"
        ]
        result = [w for w in alternatives if w.lower() not in exclude]
        return result[:WORD_COUNT]

    async def get_refresh_words(
        self,
        chat_history: list[ChatMessage],
        current_sentence: list[str],
        is_sentence_start: bool
    ) -> tuple[list[str], list[str]]:
        """
        Return cached words immediately, start generating new cache in background.
        Returns (words_to_display, empty_cache_placeholder)
        """
        # Return current cache as display words
        display_words = self.cache if self.cache else DEFAULT_CONTINUATION_WORDS[:WORD_COUNT]

        # Track these as used
        for w in display_words:
            self.used_words.add(w.lower())

        # Clear cache (will be regenerated in background)
        old_cache = self.cache
        self.cache = []

        return display_words, []

    async def generate_cache_background(
        self,
        chat_history: list[ChatMessage],
        current_sentence: list[str],
        is_sentence_start: bool
    ) -> list[str]:
        """Generate new cache in background. Called after refresh."""
        if self.is_generating_cache:
            return self.cache

        self.is_generating_cache = True
        try:
            context = self._build_context(chat_history, current_sentence)

            if is_sentence_start:
                prompt = f"""Based on this conversation context, predict {WORD_COUNT} alternative words to start a new sentence.
These should be less common but still useful sentence starters.
Order from most likely (first) to least likely (last).

{context}

Respond with ONLY a JSON array of {WORD_COUNT} words."""
            else:
                prompt = f"""Based on this context, predict {WORD_COUNT} alternative next words to continue the sentence.
These should be less common but contextually appropriate alternatives.
Include some words with ending punctuation (. ! ?) for sentence completion.
Order from most likely (first) to least likely (last).

{context}

Respond with ONLY a JSON array of {WORD_COUNT} words."""

            cache_words = await self._call_openrouter(prompt, self.used_words)
            if not cache_words:
                defaults = DEFAULT_SENTENCE_STARTERS if is_sentence_start else DEFAULT_CONTINUATION_WORDS
                cache_words = self._filter_used_words(defaults)[:WORD_COUNT]

            cache_words = self._pad_words(cache_words, is_sentence_start, self.used_words)
            self.cache = cache_words
            return cache_words
        finally:
            self.is_generating_cache = False

    def get_cached_words(self) -> list[str]:
        """Return cached words for refresh."""
        return self.cache if self.cache else DEFAULT_CONTINUATION_WORDS[:WORD_COUNT]

    def get_used_words(self) -> list[str]:
        """Return list of used words."""
        return list(self.used_words)


# Global instance
word_generator = WordGenerator()
