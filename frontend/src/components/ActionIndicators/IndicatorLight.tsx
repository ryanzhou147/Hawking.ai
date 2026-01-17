import { motion } from 'framer-motion'
import styles from './ActionIndicators.module.css'

interface IndicatorLightProps {
  label: string
  isActive: boolean
  isFading: boolean
}

export function IndicatorLight({ label, isActive, isFading }: IndicatorLightProps) {
  return (
    <div className={styles.indicator}>
      <motion.div
        className={`${styles.light} ${isActive ? styles.active : ''}`}
        initial={false}
        animate={{
          boxShadow: isActive && !isFading
            ? 'inset 0 0 15px rgba(201, 183, 138, 0.6), 0 0 10px rgba(201, 183, 138, 0.3)'
            : 'inset 0 0 0px rgba(201, 183, 138, 0)',
          backgroundColor: isActive
            ? 'var(--color-gold-light)'
            : 'transparent',
          borderColor: isActive
            ? 'var(--color-gold)'
            : 'var(--color-text-muted)'
        }}
        transition={{
          duration: isFading ? 0.7 : 0.1,
          ease: 'easeOut'
        }}
      />
      <span className={styles.label}>{label}</span>
    </div>
  )
}
