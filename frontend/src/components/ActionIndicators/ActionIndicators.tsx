import { useClenchStore } from '../../stores/useClenchStore'
import { IndicatorLight } from './IndicatorLight'
import styles from './ActionIndicators.module.css'

const INDICATORS = [
  { id: 0, label: '0 - Select' },
  { id: 1, label: '1 - Right' },
  { id: 2, label: '2 - Down' },
  { id: 3, label: '3 - Refresh' }
]

export function ActionIndicators() {
  const activeIndicator = useClenchStore((state) => state.activeIndicator)
  const isFading = useClenchStore((state) => state.isFading)

  return (
    <div className={styles.container}>
      {INDICATORS.map((indicator) => (
        <IndicatorLight
          key={indicator.id}
          label={indicator.label}
          isActive={activeIndicator === indicator.id}
          isFading={isFading && activeIndicator === indicator.id}
        />
      ))}
    </div>
  )
}
