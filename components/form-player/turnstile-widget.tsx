'use client'

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'

export interface TurnstileWidgetRef {
  reset: () => void
}

interface TurnstileWidgetProps {
  siteKey?: string
  onToken: (token: string) => void
  onError?: (errorCode?: string) => void
  onExpire?: () => void
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'compact' | 'flexible'
  language?: string
  className?: string
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string
          callback?: (token: string) => void
          'error-callback'?: (errorCode?: string) => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
          size?: 'normal' | 'compact' | 'flexible'
          language?: string
        }
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
    onloadTurnstileCallback?: () => void
  }
}

export const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(
  function TurnstileWidget(
    {
      siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
      onToken,
      onError,
      onExpire,
      theme = 'auto',
      size = 'flexible',
      language,
      className,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null)
    const widgetIdRef = useRef<string | null>(null)

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(widgetIdRef.current)
          } catch {
            // Ignore reset failures
          }
        }
      },
    }))

    useEffect(() => {
      if (!siteKey || !containerRef.current) return

      let isMounted = true

      const renderWidget = () => {
        if (!containerRef.current || !window.turnstile || !isMounted) return

        // Clean up previous widget if exists
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current)
          } catch {
            // Ignore
          }
          widgetIdRef.current = null
        }

        try {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              if (isMounted) onToken(token)
            },
            'error-callback': (err?: string) => {
              if (isMounted && onError) onError(err)
            },
            'expired-callback': () => {
              if (isMounted && onExpire) onExpire()
            },
            theme,
            size,
            language: language || 'auto',
          })
        } catch (err) {
          console.error('Failed to render Turnstile widget:', err)
        }
      }

      // Check if Turnstile script is already available
      if (window.turnstile) {
        renderWidget()
      } else {
        const SCRIPT_ID = 'cf-turnstile-script'
        let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null

        if (!script) {
          script = document.createElement('script')
          script.id = SCRIPT_ID
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
          script.async = true
          script.defer = true
          document.head.appendChild(script)
        }

        const handleLoad = () => {
          if (isMounted) renderWidget()
        }

        script.addEventListener('load', handleLoad)
        return () => {
          isMounted = false
          script?.removeEventListener('load', handleLoad)
          if (widgetIdRef.current && window.turnstile) {
            try {
              window.turnstile.remove(widgetIdRef.current)
            } catch {
              // Ignore
            }
          }
        }
      }

      return () => {
        isMounted = false
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current)
          } catch {
            // Ignore
          }
        }
      }
    }, [siteKey, onToken, onError, onExpire, theme, size, language])

    // If siteKey is not provided (e.g. dev/local test environment), render nothing
    if (!siteKey) {
      return null
    }

    return (
      <div 
        ref={containerRef} 
        className={className || 'my-2 flex justify-start items-center min-h-[65px]'}
        data-testid="turnstile-container"
      />
    )
  }
)
