import { ReactNode, useEffect, useRef, useState } from 'react'
import styles from './Layout.module.css'

interface LayoutProps {
  leftPanel: ReactNode
  rightPanel: ReactNode
  bottomBar: ReactNode
}

export function Layout({ leftPanel, rightPanel, bottomBar }: LayoutProps) {
  const [leftWidth, setLeftWidth] = useState(60)
  const isDragging = useRef(false)
  const mainRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function updateWidth(clientX: number) {
      if (!mainRef.current) return

      const rect = mainRef.current.getBoundingClientRect()
      const offsetX = clientX - rect.left
      const percentage = (offsetX / rect.width) * 100
      const clamped = Math.min(80, Math.max(20, percentage))

      setLeftWidth(clamped)
    }

    function handleMouseMove(event: MouseEvent) {
      if (!isDragging.current) return
      updateWidth(event.clientX)
    }

    function handleTouchMove(event: TouchEvent) {
      if (!isDragging.current) return
      if (event.touches.length === 0) return
      const touch = event.touches[0]
      updateWidth(touch.clientX)
    }

    function stopDragging() {
      isDragging.current = false
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', stopDragging)
    window.addEventListener('touchmove', handleTouchMove)
    window.addEventListener('touchend', stopDragging)
    window.addEventListener('touchcancel', stopDragging)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', stopDragging)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', stopDragging)
      window.removeEventListener('touchcancel', stopDragging)
    }
  }, [])

  function handleMouseDown() {
    isDragging.current = true
  }

  function handleTouchStart() {
    isDragging.current = true
  }

  return (
    <div className={styles.layout}>
      <div className={styles.mainContent} ref={mainRef}>
        <div
          className={styles.leftPanel}
          style={{ flexBasis: `${leftWidth}%` }}
        >
          {leftPanel}
        </div>
        <div
          className={styles.divider}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        />
        <div
          className={styles.rightPanel}
          style={{ flexBasis: `${100 - leftWidth}%` }}
        >
          {rightPanel}
        </div>
      </div>
      <div className={styles.bottomBar}>
        {bottomBar}
      </div>
    </div>
  )
}
