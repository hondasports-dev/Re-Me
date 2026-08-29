import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { PUSH_PERMISSION_COPY } from '../../src/features/settings/model/push'
import { SettingsPage } from '../../src/features/settings/pages/SettingsPage'
import { reMeTheme } from '../../src/styles/theme'

vi.mock('convex/react', () => ({
  useMutation: () => vi.fn(),
}))

describe('settings page', () => {
  it('explains quiet notifications before any permission request and keeps the app usable', async () => {
    render(
      <MantineProvider theme={reMeTheme}>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </MantineProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText(PUSH_PERMISSION_COPY)).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { name: '設定' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'このブラウザでは通知を使えません。手紙の作成・受信・開封はそのまま使えます。',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '到着通知を受け取る' })).not.toBeInTheDocument()
  })
})
