// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { useVisiblePolling } from './useVisiblePolling'

function Poller({ read, interval = 1000 }: { read: () => void | Promise<unknown>; interval?: number }) {
  useVisiblePolling(read, interval)
  return null
}

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})

describe('useVisiblePolling', () => {
  it('reads immediately and then at the selected interval', async () => {
    vi.useFakeTimers()
    const read = vi.fn()
    render(<Poller read={read} interval={1000} />)

    expect(read).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(read).toHaveBeenCalledTimes(4)
  })

  it('refreshes immediately when the read scope changes', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<Poller read={first} />)
    expect(first).toHaveBeenCalledTimes(1)

    rerender(<Poller read={second} />)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('pauses in hidden tabs and refreshes once when shown', async () => {
    vi.useFakeTimers()
    const read = vi.fn()
    render(<Poller read={read} interval={1000} />)
    expect(read).toHaveBeenCalledTimes(1)

    setVisibility('hidden')
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(read).toHaveBeenCalledTimes(1)

    setVisibility('visible')
    expect(read).toHaveBeenCalledTimes(2)
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('does not overlap a read that takes longer than the interval', async () => {
    vi.useFakeTimers()
    let finish!: () => void
    let active = 0
    let maxActive = 0
    const read = vi.fn(() => {
      active += 1
      maxActive = Math.max(maxActive, active)
      return new Promise<void>(resolve => {
        finish = () => { active -= 1; resolve() }
      })
    })
    render(<Poller read={read} interval={1000} />)

    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    expect(read).toHaveBeenCalledTimes(1)
    expect(maxActive).toBe(1)

    await act(async () => { finish(); await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(read).toHaveBeenCalledTimes(2)
    expect(maxActive).toBe(1)
  })

  it('does not start another read after unmount', async () => {
    vi.useFakeTimers()
    const read = vi.fn()
    const { unmount } = render(<Poller read={read} interval={1000} />)
    unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
    expect(read).toHaveBeenCalledTimes(1)
  })
})
