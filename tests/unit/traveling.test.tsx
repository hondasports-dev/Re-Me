import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { TravelingErrorBoundary } from '../../src/features/traveling/components/TravelingErrorBoundary'
import { TravelingLetterDetail } from '../../src/features/traveling/components/TravelingLetterDetail'
import { TravelingLetterList } from '../../src/features/traveling/components/TravelingLetterList'
import {
  canFetchTravelingContent,
  formatDeliveryWindow,
  travelingContentQueryArgs,
  travelingListItemLabel,
  travelingListPhase,
  travelingSealLabel,
} from '../../src/features/traveling/model/traveling'
import { reMeTheme } from '../../src/styles/theme'

const openLetter = {
  letterId: 'letter-open',
  sealed: false,
  deliveryMode: 'few_weeks' as const,
  deliveryWindowStart: Date.UTC(2026, 8, 1),
  deliveryWindowEnd: Date.UTC(2026, 8, 16),
  sentAt: Date.UTC(2026, 7, 28),
  status: 'traveling' as const,
}

const sealedLetter = {
  ...openLetter,
  letterId: 'letter-sealed',
  sealed: true,
  deliveryMode: 'few_days' as const,
}

function renderWithRouter(node: ReactNode) {
  return render(
    <MantineProvider theme={reMeTheme}>
      <MemoryRouter>{node}</MemoryRouter>
    </MantineProvider>,
  )
}

describe('traveling model', () => {
  it('formats the delivery window without exposing an exact time of day', () => {
    const start = Date.UTC(2026, 7, 31, 15, 45, 12)
    const end = Date.UTC(2026, 8, 4, 3, 12, 9)

    expect(formatDeliveryWindow(start, end, 'UTC')).toBe('2026年8月31日 〜 2026年9月4日ごろ')
    expect(formatDeliveryWindow(start, start, 'UTC')).toBe('2026年8月31日ごろ')
    expect(formatDeliveryWindow(null, end, 'UTC')).toBe('届くころはまだ見えていません')
    expect(travelingSealLabel(true)).toBe('封をしている')
    expect(travelingSealLabel(false)).toBe('読み返せる')
    expect(travelingListItemLabel(sealedLetter, 'UTC')).toContain('封をしている')
  })

  it('skips content fetch for sealed or missing traveling letters', () => {
    expect(travelingListPhase(undefined)).toBe('loading')
    expect(travelingListPhase([])).toBe('empty')
    expect(travelingListPhase([openLetter])).toBe('list')
    expect(canFetchTravelingContent(undefined)).toBe(false)
    expect(canFetchTravelingContent(null)).toBe(false)
    expect(canFetchTravelingContent({ status: 'traveling', sealed: true })).toBe(false)
    expect(canFetchTravelingContent({ status: 'delivered', sealed: false })).toBe(false)
    expect(canFetchTravelingContent({ status: 'traveling', sealed: false })).toBe(true)
    expect(travelingContentQueryArgs('letter-sealed', sealedLetter)).toBe('skip')
    expect(travelingContentQueryArgs('letter-open', openLetter)).toEqual({
      letterId: 'letter-open',
    })
    expect(travelingContentQueryArgs(undefined, openLetter)).toBe('skip')
  })
})

describe('TravelingLetterList', () => {
  it('shows loading then empty then the traveling list without letter bodies', () => {
    const loading = renderWithRouter(<TravelingLetterList letters={undefined} timeZone="UTC" />)
    expect(loading.getByRole('heading', { name: '旅する手紙' })).toBeInTheDocument()
    expect(
      loading.getByRole('heading', { name: '旅する手紙' }).closest('[data-status]'),
    ).toHaveAttribute('data-status', 'content-loading')
    loading.unmount()

    const empty = renderWithRouter(<TravelingLetterList letters={[]} timeZone="UTC" />)
    expect(empty.getByText('未来へ向かっている手紙は、まだありません。')).toBeInTheDocument()
    empty.unmount()

    const list = renderWithRouter(
      <TravelingLetterList letters={[openLetter, sealedLetter]} timeZone="UTC" />,
    )
    expect(list.getByRole('link', { name: /読み返せる/ })).toHaveAttribute(
      'href',
      '/traveling/letter-open',
    )
    expect(list.getByText('封をしている')).toBeInTheDocument()
    expect(list.getByText('数週間後くらい')).toBeInTheDocument()
    expect(list.queryByText('秘密の本文')).not.toBeInTheDocument()
    expect(list.queryByRole('textbox')).not.toBeInTheDocument()
  })
})

describe('TravelingLetterDetail', () => {
  it('does not render sealed traveling content and keeps it read-only', () => {
    renderWithRouter(
      <TravelingLetterDetail
        attachments={undefined}
        content={undefined}
        metadata={sealedLetter}
        onDelete={async () => undefined}
        timeZone="UTC"
      />,
    )

    expect(screen.getByRole('heading', { name: '封をしている' })).toBeInTheDocument()
    expect(screen.getByText('届くまで、あなたも読むことができません。')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText('秘密の本文')).not.toBeInTheDocument()
  })

  it('shows unsealed body as read-only and deletes after confirmation', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn(async () => undefined)

    renderWithRouter(
      <TravelingLetterDetail
        attachments={[
          {
            attachmentId: 'att-1',
            kind: 'location',
            status: 'ready',
            generationToken: null,
            locationLabel: '鴨川',
          },
        ]}
        content={{ body: '未来の自分へ' }}
        metadata={openLetter}
        onDelete={onDelete}
        timeZone="UTC"
      />,
    )

    expect(screen.getByText('未来の自分へ')).toBeInTheDocument()
    expect(screen.getByText('場所「鴨川」')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'この手紙を削除する' }))
    expect(screen.getByRole('alertdialog', { name: 'この手紙を削除しますか' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '削除する' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'やめる' }))
    expect(screen.getByRole('button', { name: 'この手紙を削除する' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'この手紙を削除する' }))
    await user.click(screen.getByRole('button', { name: '削除する' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })
})

describe('TravelingErrorBoundary', () => {
  it('renders a content error status', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    function Boom(): never {
      throw new Error('traveling query failed')
    }

    render(
      <MantineProvider theme={reMeTheme}>
        <TravelingErrorBoundary>
          <Boom />
        </TravelingErrorBoundary>
      </MantineProvider>,
    )

    expect(screen.getByRole('alert')).toHaveAttribute('data-status', 'content-error')
    spy.mockRestore()
  })
})
