import { ReactNode } from 'react'
import styles from './Layout.module.css'

interface LayoutProps {
  leftPanel: ReactNode
  rightPanel: ReactNode
  bottomBar: ReactNode
  devMode?: boolean
}

export function Layout({ leftPanel, rightPanel, bottomBar, devMode }: LayoutProps) {
  return (
    <div className={styles.layout}>
      {devMode && <div className="dev-badge">DEV MODE</div>}
      <div className={styles.mainContent}>
        <div className={styles.leftPanel}>
          {leftPanel}
        </div>
        <div className={styles.divider} />
        <div className={styles.rightPanel}>
          {rightPanel}
        </div>
      </div>
      <div className={styles.bottomBar}>
        {bottomBar}
      </div>
    </div>
  )
}
