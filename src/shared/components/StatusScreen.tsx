import type { ReactNode } from 'react'

export type StatusTone = 'auth' | 'backend' | 'content'
export type StatusVariant = 'empty' | 'error' | 'loading'

export interface StatusScreenProps {
  action?: ReactNode
  description?: string
  title: string
  tone: StatusTone
  variant: StatusVariant
}

export function StatusScreen({ action, description, title, tone, variant }: StatusScreenProps) {
  const status = `${tone}-${variant}`
  const isError = variant === 'error'
  const isLoading = variant === 'loading'
  const Heading = tone === 'content' ? 'h2' : 'h1'

  return (
    <section
      aria-labelledby={`${status}-title`}
      aria-live={isLoading ? 'polite' : undefined}
      className="status-screen"
      data-status={status}
      role={isError ? 'alert' : isLoading ? 'status' : undefined}
    >
      <div className="status-screen__panel">
        <p className="status-screen__eyebrow">{eyebrowFor(tone, variant)}</p>
        <Heading className="status-screen__title" id={`${status}-title`}>
          {title}
        </Heading>
        {description ? <p className="status-screen__description">{description}</p> : null}
        {isLoading ? <span className="status-screen__spinner" aria-hidden="true" /> : null}
        {action ? <div className="status-screen__action">{action}</div> : null}
      </div>
    </section>
  )
}

function eyebrowFor(tone: StatusTone, variant: StatusVariant): string {
  if (tone === 'auth') {
    return variant === 'error' ? '認証エラー' : '認証'
  }

  if (tone === 'backend') {
    return variant === 'error' ? '接続エラー' : '接続'
  }

  if (variant === 'error') {
    return '読み込みエラー'
  }

  if (variant === 'empty') {
    return 'Re:Me'
  }

  return '読み込み中'
}
