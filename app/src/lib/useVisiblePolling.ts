import { useEffect, useRef } from 'react'

/**
 * Run an async read now and at a fixed interval while this tab is visible.
 * A slow read never overlaps the next poll. Returning to the tab requests one
 * fresh read immediately. A changed read callback starts a fresh cycle, so
 * changes to its team or filters load the new scope without waiting.
 */
export function useVisiblePolling(
  read: () => void | Promise<unknown>,
  intervalMs: number,
  enabled = true,
): void {
  const readRef = useRef(read)
  readRef.current = read

  useEffect(() => {
    if (!enabled) return

    let active = true
    let running = false

    const run = async () => {
      if (!active || document.visibilityState === 'hidden' || running) return
      running = true
      try {
        await readRef.current()
      } catch {
        // A poll failure must not stop later attempts. The caller owns errors.
      } finally {
        running = false
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') void run()
    }

    void run()
    const timer = window.setInterval(() => void run(), intervalMs)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, intervalMs, read])
}
