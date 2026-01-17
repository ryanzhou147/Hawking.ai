import { useGridStore } from '../../stores/useGridStore'
import { useAutoSelect } from '../../hooks/useAutoSelect'
import { WordCell } from './WordCell'
import styles from './WordGrid.module.css'

export function WordGrid() {
  const words = useGridStore((state) => state.words)
  const cursorPosition = useGridStore((state) => state.cursorPosition)
  const mode = useGridStore((state) => state.mode)
  const { progress } = useAutoSelect()

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.modeLabel}>
          {mode === 'sentence-start' ? 'Start your sentence' : 'Continue...'}
        </span>
      </div>
      <div className={styles.grid}>
        {words.map((word, index) => (
          <WordCell
            key={`${index}-${word}`}
            word={word}
            index={index}
            isActive={index === cursorPosition}
            progress={index === cursorPosition ? progress : 0}
          />
        ))}
      </div>
    </div>
  )
}
