import { motion } from 'framer-motion'
import styles from './WordGrid.module.css'

interface WordCellProps {
  word: string
  index: number
  isActive: boolean
  progress: number
}

export function WordCell({ word, index, isActive, progress }: WordCellProps) {
  return (
    <motion.div
      className={`${styles.cell} ${isActive ? styles.active : ''}`}
      initial={false}
      animate={{
        scale: isActive ? 1.02 : 1,
        boxShadow: isActive
          ? '0 0 20px rgba(201, 183, 138, 0.4)'
          : '0 1px 2px rgba(0, 0, 0, 0.05)'
      }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      <span className={styles.word}>{word}</span>
      <span className={styles.gridLabel}>Grid {index + 1}</span>

      {isActive && (
        <div className={styles.progressContainer}>
          <motion.div
            className={styles.progressBar}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.016, ease: 'linear' }}
          />
        </div>
      )}
    </motion.div>
  )
}
