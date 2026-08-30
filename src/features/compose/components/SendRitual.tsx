import { useEffect } from 'react'

import { SEND_RITUAL_MS, SEND_RITUAL_REDUCED_MS } from '../model/compose'

interface SendRitualProps {
  onFinished: () => void
  reducedMotion: boolean
}

/** Shows the short, reduced-motion-aware ritual after a letter is sent. */
export function SendRitual({ onFinished, reducedMotion }: SendRitualProps) {
  useEffect(() => {
    const timeout = window.setTimeout(
      onFinished,
      reducedMotion ? SEND_RITUAL_REDUCED_MS : SEND_RITUAL_MS,
    )

    return () => {
      window.clearTimeout(timeout)
    }
  }, [onFinished, reducedMotion])

  return (
    <section
      aria-live="polite"
      className="send-ritual"
      data-reduced={reducedMotion ? 'true' : 'false'}
    >
      <img
        alt=""
        aria-hidden="true"
        className="send-ritual__envelope"
        src="/images/re-me-envelope.png"
      />
      <h1>手紙は未来へ旅立ちました</h1>
      <p>これからのあなたのもとへ向かっています。</p>
    </section>
  )
}
