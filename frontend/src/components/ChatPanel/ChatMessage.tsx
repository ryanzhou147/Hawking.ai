import { motion } from 'framer-motion'
import type { ChatMessage as ChatMessageType } from '../../stores/useChatStore'
import styles from './ChatPanel.module.css'

interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const timeString = message.timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <motion.div
      className={`${styles.message} ${message.isUser ? styles.userMessage : styles.systemMessage}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <p className={styles.messageText}>{message.text}</p>
      <span className={styles.timestamp}>{timeString}</span>
    </motion.div>
  )
}
