import { motion, AnimatePresence } from 'framer-motion'
import { useChatStore } from '../../stores/useChatStore'
import styles from './CurrentSentence.module.css'

export function CurrentSentence() {
  const currentSentence = useChatStore((state) => state.currentSentence)

  if (currentSentence.length === 0) {
    return null
  }

  return (
    <div className={styles.container}>
      <div className={styles.label}>Building sentence:</div>
      <div className={styles.sentence}>
        <AnimatePresence mode="popLayout">
          {currentSentence.map((word, index) => (
            <motion.span
              key={`${index}-${word}`}
              className={styles.word}
              initial={{ opacity: 0, scale: 0.8, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              {word}
            </motion.span>
          ))}
        </AnimatePresence>
        <motion.span
          className={styles.cursor}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          |
        </motion.span>
      </div>
    </div>
  )
}
