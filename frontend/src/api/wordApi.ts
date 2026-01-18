const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export interface ChatMessage {
  text: string
  is_user: boolean
}

export interface WordRequest {
  chat_history: ChatMessage[]
  current_sentence: string[]
  is_sentence_start: boolean
}

export interface WordResponse {
  words: string[]
  cached_words: string[]
  two_step_predictions?: Record<string, string[]>
  two_step_time_ms?: number
}

export async function fetchWords(request: WordRequest): Promise<WordResponse> {
  const response = await fetch(`${API_BASE_URL}/api/words`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch words: ${response.statusText}`)
  }

  return response.json()
}

export async function refreshWords(request: WordRequest): Promise<WordResponse> {
  const response = await fetch(`${API_BASE_URL}/api/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Failed to refresh words: ${response.statusText}`)
  }

  return response.json()
}

export async function generateCacheInBackground(request: WordRequest): Promise<void> {
  // Fire and forget - don't wait for response
  fetch(`${API_BASE_URL}/api/generate-cache`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  }).catch(err => console.error('Background cache generation failed:', err))
}

export async function getCache(): Promise<{ cached_words: string[], used_words: string[] }> {
  const response = await fetch(`${API_BASE_URL}/api/cache`)
  if (!response.ok) {
    throw new Error(`Failed to get cache: ${response.statusText}`)
  }
  return response.json()
}

export async function clearUsedWords(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/clear-used`, { method: 'POST' })
}

export async function resetBranch(request: WordRequest & { first_word: string }): Promise<{ words: string[] }> {
  const response = await fetch(`${API_BASE_URL}/api/reset-branch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`Failed to reset branch: ${response.statusText}`)
  }

  return response.json()
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`)
    return response.ok
  } catch {
    return false
  }
}

export async function cloneVoiceFromFile(file: File): Promise<string> {
  const formData = new FormData()
  const name = file.name.replace(/\.[^/.]+$/, '') || 'user-voice'
  formData.append('name', name)
  formData.append('audio_file', file)

  const response = await fetch(`${API_BASE_URL}/api/clone-voice`, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    throw new Error(`Failed to clone voice: ${response.statusText}`)
  }

  const data = await response.json()

  if (!data.voice_id) {
    throw new Error('Clone voice response did not include voice_id')
  }

  return data.voice_id as string
}

export async function setActiveVoice(voiceId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/set-voice?voice_id=${encodeURIComponent(voiceId)}`, {
    method: 'POST'
  })

  if (!response.ok) {
    throw new Error(`Failed to set active voice: ${response.statusText}`)
  }
}

export async function speakSentence(text: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/speak-sentence`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    throw new Error(`Failed to speak sentence: ${response.statusText}`)
  }

  const audioData = await response.arrayBuffer()
  const blob = new Blob([audioData], { type: 'audio/mpeg' })
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  audio.play().catch(() => {})
}
