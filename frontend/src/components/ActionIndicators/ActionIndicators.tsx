import { useRef, useState } from 'react'
import { useClenchStore } from '../../stores/useClenchStore'
import { cloneVoiceFromFile, setActiveVoice } from '../../api/wordApi'
import { IndicatorLight } from './IndicatorLight'
import styles from './ActionIndicators.module.css'

const INDICATORS = [
  { id: 1, label: 'Right' },
  { id: 2, label: 'Down' },
  { id: 3, label: 'Select' }
]

export function ActionIndicators() {
  const activeIndicator = useClenchStore((state) => state.activeIndicator)
  const isFading = useClenchStore((state) => state.isFading)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    const isAudioType = file.type.startsWith('audio/')
    const isAudioExtension = /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(file.name)
    if (!isAudioType && !isAudioExtension) {
      setStatus('error')
      return
    }

    setStatus('processing')

    try {
      const voiceId = await cloneVoiceFromFile(file)
      await setActiveVoice(voiceId)
      setStatus('done')
    } catch (error) {
      console.error('Failed to clone voice from file:', error)
      setStatus('error')
    }
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragOver(false)
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragOver(false)
    const files = event.dataTransfer.files
    void handleFiles(files)
  }

  function handleClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    void handleFiles(files)
    event.target.value = ''
  }

  return (
    <div className={styles.container}>
      <div
        className={`${styles.audioDropZone} ${isDragOver ? styles.audioDropZoneActive : ''} ${status === 'processing' ? styles.audioDropZoneProcessing : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <div className={styles.audioIcon}>
          {status === 'processing' ? (
            <div className={styles.spinner} />
          ) : (
            <span>♪</span>
          )}
        </div>
        <div className={styles.audioText}>
          {status === 'processing' && 'Processing...'}
          {status === 'done' && 'Done'}
          {status === 'idle' && 'Click or drag audio'}
          {status === 'error' && 'Error'}
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
        className={styles.fileInput}
        onChange={handleFileChange}
      />
      <div className={styles.indicators}>
        {INDICATORS.map((indicator) => (
          <IndicatorLight
            key={indicator.id}
            label={indicator.label}
            isActive={activeIndicator === indicator.id}
            isFading={isFading && activeIndicator === indicator.id}
          />
        ))}
      </div>
    </div>
  )
}
