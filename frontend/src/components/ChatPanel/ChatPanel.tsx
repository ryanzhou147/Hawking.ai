import { useEffect, useRef } from 'react'
import { useChatStore } from '../../stores/useChatStore'
import { ChatMessage } from './ChatMessage'
import { CurrentSentence } from '../CurrentSentence'
import styles from './ChatPanel.module.css'

export function ChatPanel() {
  const messages = useChatStore((state) => state.messages)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Conversation</h2>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Your messages will appear here.</p>
            <p className={styles.hint}>Use the grid to compose sentences.</p>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <CurrentSentence />
    </div>
  )
}
