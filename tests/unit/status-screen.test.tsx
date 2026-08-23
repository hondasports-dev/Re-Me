import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatusScreen } from '../../src/shared/components/StatusScreen'

describe('StatusScreen', () => {
  it('distinguishes auth, backend, and content states', () => {
    const auth = render(
      <StatusScreen
        description="認証の確認中"
        title="認証を確認しています"
        tone="auth"
        variant="loading"
      />,
    )
    expect(auth.getByRole('status')).toHaveAttribute('data-status', 'auth-loading')
    expect(auth.getByText('認証')).toBeInTheDocument()

    auth.unmount()

    const backend = render(
      <StatusScreen
        description="接続の確認中"
        title="接続を確認しています"
        tone="backend"
        variant="loading"
      />,
    )
    expect(backend.getByRole('status')).toHaveAttribute('data-status', 'backend-loading')
    expect(backend.getByText('接続')).toBeInTheDocument()

    backend.unmount()

    const empty = render(
      <StatusScreen
        description="まだ手紙はありません"
        title="届いた手紙"
        tone="content"
        variant="empty"
      />,
    )
    expect(
      empty.getByRole('heading', { name: '届いた手紙' }).closest('[data-status]'),
    ).toHaveAttribute('data-status', 'content-empty')
    expect(empty.queryByRole('status')).not.toBeInTheDocument()
    expect(empty.queryByRole('alert')).not.toBeInTheDocument()

    empty.unmount()

    const error = render(
      <StatusScreen
        description="読み込めませんでした"
        title="手紙を表示できません"
        tone="content"
        variant="error"
      />,
    )
    expect(error.getByRole('alert')).toHaveAttribute('data-status', 'content-error')
    expect(error.getByText('読み込みエラー')).toBeInTheDocument()
  })
})
