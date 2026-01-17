from pydantic import BaseModel
from typing import Optional

class ChatMessage(BaseModel):
    text: str
    is_user: bool

class WordRequest(BaseModel):
    chat_history: list[ChatMessage] = []
    current_sentence: list[str] = []
    is_sentence_start: bool = True

class WordResponse(BaseModel):
    words: list[str]  # 25 words, ordered by likelihood
    cached_words: list[str]  # 25 cached words for refresh

class RefreshRequest(BaseModel):
    chat_history: list[ChatMessage] = []
    current_sentence: list[str] = []
    is_sentence_start: bool = True
