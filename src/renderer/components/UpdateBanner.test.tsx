import { render } from '@testing-library/react'
import { UpdateBanner } from './UpdateBanner'

describe('UpdateBanner', () => {
  it('renders without crashing when updater is available', () => {
    const { container } = render(<UpdateBanner />)
    // No update info → nothing shown
    expect(container.firstChild).toBeNull()
  })

  it('renders without crashing when updater is missing', () => {
    const original = window.electronAPI
    // Simulate missing updater namespace
    Object.defineProperty(window, 'electronAPI', {
      value: { ...original, updater: undefined },
      writable: true,
    })

    const { container } = render(<UpdateBanner />)
    expect(container.firstChild).toBeNull()

    // Restore
    Object.defineProperty(window, 'electronAPI', {
      value: original,
      writable: true,
    })
  })

  it('renders without crashing when electronAPI is missing', () => {
    const original = window.electronAPI
    Object.defineProperty(window, 'electronAPI', {
      value: undefined,
      writable: true,
    })

    const { container } = render(<UpdateBanner />)
    expect(container.firstChild).toBeNull()

    Object.defineProperty(window, 'electronAPI', {
      value: original,
      writable: true,
    })
  })
})
