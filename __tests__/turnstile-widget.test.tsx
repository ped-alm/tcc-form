import React, { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { TurnstileWidget, TurnstileWidgetRef } from '@/components/form-player/turnstile-widget'

describe('TurnstileWidget Component', () => {
  let renderMock: ReturnType<typeof vi.fn>
  let resetMock: ReturnType<typeof vi.fn>
  let removeMock: ReturnType<typeof vi.fn>
  let capturedOptions: {
    callback?: (token: string) => void
    'error-callback'?: (err?: string) => void
    'expired-callback'?: () => void
    [key: string]: unknown
  } = {}

  beforeEach(() => {
    capturedOptions = {}
    renderMock = vi.fn((_container, options) => {
      capturedOptions = options
      return 'mock-widget-id-123'
    })
    resetMock = vi.fn()
    removeMock = vi.fn()

    window.turnstile = {
      render: renderMock,
      reset: resetMock,
      remove: removeMock,
    }
  })

  afterEach(() => {
    delete (window as unknown as { turnstile?: unknown }).turnstile
    vi.restoreAllMocks()
  })

  it('renders the turnstile container and initializes widget when siteKey is provided', () => {
    const onToken = vi.fn()

    render(
      <TurnstileWidget
        siteKey="test-site-key"
        onToken={onToken}
        theme="dark"
        language="pt"
      />
    )

    expect(screen.getByTestId('turnstile-container')).toBeInTheDocument()
    expect(renderMock).toHaveBeenCalledTimes(1)
    expect(renderMock).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        sitekey: 'test-site-key',
        theme: 'dark',
        language: 'pt',
        size: 'flexible',
      })
    )
  })

  it('renders null when siteKey is missing', () => {
    render(<TurnstileWidget siteKey="" onToken={vi.fn()} />)

    expect(screen.queryByTestId('turnstile-container')).not.toBeInTheDocument()
    expect(renderMock).not.toHaveBeenCalled()
  })

  it('does NOT re-render or remove Turnstile widget when parent re-renders with new callback instances', () => {
    let parentRenderCount = 0

    function ParentWrapper() {
      const [count, setCount] = useState(0)
      parentRenderCount++

      return (
        <div>
          <button onClick={() => setCount(c => c + 1)}>Increment</button>
          <TurnstileWidget
            siteKey="test-site-key"
            // Fresh inline callbacks created on every render
            onToken={(token) => {
              void token
              void count
            }}
            onError={() => {
              void count
            }}
            onExpire={() => {
              void count
            }}
          />
        </div>
      )
    }

    render(<ParentWrapper />)
    expect(renderMock).toHaveBeenCalledTimes(1)
    expect(removeMock).not.toHaveBeenCalled()

    // Trigger parent re-render (simulating typing in an input field)
    const button = screen.getByRole('button', { name: 'Increment' })
    act(() => {
      button.click()
    })

    expect(parentRenderCount).toBe(2)
    // Widget must NOT have been removed or re-rendered
    expect(removeMock).not.toHaveBeenCalled()
    expect(renderMock).toHaveBeenCalledTimes(1)

    // Trigger another parent re-render
    act(() => {
      button.click()
    })

    expect(parentRenderCount).toBe(3)
    expect(removeMock).not.toHaveBeenCalled()
    expect(renderMock).toHaveBeenCalledTimes(1)
  })

  it('invokes the latest parent callback even after parent re-renders', () => {
    const receivedTokens: string[] = []

    function ParentWrapper() {
      const [prefix, setPrefix] = useState('first')

      return (
        <div>
          <button onClick={() => setPrefix('second')}>Update Prefix</button>
          <TurnstileWidget
            siteKey="test-site-key"
            onToken={(token) => receivedTokens.push(`${prefix}:${token}`)}
          />
        </div>
      )
    }

    render(<ParentWrapper />)

    // Update parent state
    const button = screen.getByRole('button', { name: 'Update Prefix' })
    act(() => {
      button.click()
    })

    // Now trigger Turnstile callback
    act(() => {
      capturedOptions.callback?.('token-abc')
    })

    // Callback should have captured the updated state ('second:token-abc')
    expect(receivedTokens).toEqual(['second:token-abc'])
  })

  it('invokes latest onError and onExpire callbacks', () => {
    const onError = vi.fn()
    const onExpire = vi.fn()

    render(
      <TurnstileWidget
        siteKey="test-site-key"
        onToken={vi.fn()}
        onError={onError}
        onExpire={onExpire}
      />
    )

    act(() => {
      capturedOptions['error-callback']?.('timeout')
    })
    expect(onError).toHaveBeenCalledWith('timeout')

    act(() => {
      capturedOptions['expired-callback']?.()
    })
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('resets widget when ref.reset() is called', () => {
    const ref = React.createRef<TurnstileWidgetRef>()

    render(
      <TurnstileWidget
        ref={ref}
        siteKey="test-site-key"
        onToken={vi.fn()}
      />
    )

    act(() => {
      ref.current?.reset()
    })

    expect(resetMock).toHaveBeenCalledWith('mock-widget-id-123')
  })

  it('re-renders widget when language or theme changes', () => {
    const { rerender } = render(
      <TurnstileWidget
        siteKey="test-site-key"
        onToken={vi.fn()}
        theme="light"
        language="pt"
      />
    )

    expect(renderMock).toHaveBeenCalledTimes(1)

    // Change language prop
    rerender(
      <TurnstileWidget
        siteKey="test-site-key"
        onToken={vi.fn()}
        theme="light"
        language="en"
      />
    )

    expect(removeMock).toHaveBeenCalledWith('mock-widget-id-123')
    expect(renderMock).toHaveBeenCalledTimes(2)
  })

  it('cleans up turnstile widget on unmount', () => {
    const { unmount } = render(
      <TurnstileWidget
        siteKey="test-site-key"
        onToken={vi.fn()}
      />
    )

    unmount()
    expect(removeMock).toHaveBeenCalledWith('mock-widget-id-123')
  })
})
