import { MantineProvider } from '@mantine/core'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { InboxErrorBoundary } from '../../src/features/inbox/components/InboxErrorBoundary'
import { InboxLetterDetail } from '../../src/features/inbox/components/InboxLetterDetail'
import { InboxLetterList } from '../../src/features/inbox/components/InboxLetterList'
import { InboxPhotoList } from '../../src/features/inbox/components/InboxPhotoList'
import {
  arrivedTodayLabel,
  calendarDaysBetween,
  canFetchInboxContent,
  fromYouLabel,
  inboxContentQueryArgs,
  inboxListItemLabel,
  inboxListPhase,
  inboxOpenLabel,
  needsOpenRitual,
} from '../../src/features/inbox/model/inbox'
import { reMeTheme } from '../../src/styles/theme'

const { mockCreateDownloadCapability } = vi.hoisted(() => ({
  mockCreateDownloadCapability: vi.fn(),
}))

vi.mock('convex/react', () => ({
  useAction: () => mockCreateDownloadCapability,
}))

const now = Date.UTC(2026, 7, 29, 12, 0, 0)

const sealedUnopened = {
  letterId: 'letter-sealed',
  sealed: true,
  sentAt: Date.UTC(2026, 7, 26, 12, 0, 0),
  deliveredAt: Date.UTC(2026, 7, 29, 3, 0, 0),
  openedAt: null,
  status: 'delivered' as const,
}

const unsealedDelivered = {
  letterId: 'letter-open',
  sealed: false,
  sentAt: Date.UTC(2026, 7, 29, 1, 0, 0),
  deliveredAt: Date.UTC(2026, 7, 28, 12, 0, 0),
  openedAt: null,
  status: 'delivered' as const,
}

function renderWithRouter(node: ReactNode) {
  return render(
    <MantineProvider theme={reMeTheme}>
      <MemoryRouter>{node}</MemoryRouter>
    </MantineProvider>,
  )
}

describe('inbox model', () => {
  it('counts elapsed calendar days in the user time zone', () => {
    const sentAt = Date.UTC(2026, 7, 27, 15, 0, 0)

    expect(fromYouLabel(sentAt, Date.UTC(2026, 7, 28, 14, 59, 0), 'Asia/Tokyo')).toBe(
      '今日のあなたから',
    )
    expect(fromYouLabel(sentAt, Date.UTC(2026, 7, 28, 15, 0, 0), 'Asia/Tokyo')).toBe(
      '1日前のあなたから',
    )
    expect(fromYouLabel(Date.UTC(2026, 7, 26, 12, 0, 0), now, 'UTC')).toBe('3日前のあなたから')
    expect(calendarDaysBetween(sentAt, Date.UTC(2026, 7, 28, 14, 59, 0), 'Asia/Tokyo')).toBe(0)
    expect(arrivedTodayLabel(Date.UTC(2026, 7, 29, 1, 0, 0), now, 'UTC')).toBe('今日届きました')
    expect(arrivedTodayLabel(Date.UTC(2026, 7, 28, 12, 0, 0), now, 'UTC')).toBeNull()
    expect(inboxOpenLabel(true, null)).toBe('未開封')
    expect(inboxOpenLabel(true, now)).toBe('開封済み')
    expect(inboxOpenLabel(false, null)).toBe('開封済み')
    expect(inboxListItemLabel(sealedUnopened, now, 'UTC')).toContain('未開封')
    expect(inboxListItemLabel(sealedUnopened, now, 'UTC')).toContain('3日前のあなたから')
    expect(inboxListItemLabel(sealedUnopened, now, 'UTC')).toContain('今日届きました')
  })

  it('skips content fetch until a delivered letter is readable', () => {
    expect(inboxListPhase(undefined)).toBe('loading')
    expect(inboxListPhase([])).toBe('empty')
    expect(inboxListPhase([sealedUnopened])).toBe('list')
    expect(canFetchInboxContent(undefined)).toBe(false)
    expect(canFetchInboxContent(null)).toBe(false)
    expect(canFetchInboxContent({ status: 'traveling', sealed: false, openedAt: null })).toBe(false)
    expect(canFetchInboxContent(sealedUnopened)).toBe(false)
    expect(canFetchInboxContent(unsealedDelivered)).toBe(true)
    expect(canFetchInboxContent({ ...sealedUnopened, openedAt: now })).toBe(true)
    expect(needsOpenRitual(sealedUnopened)).toBe(true)
    expect(needsOpenRitual(unsealedDelivered)).toBe(false)
    expect(inboxContentQueryArgs('letter-sealed', sealedUnopened)).toBe('skip')
    expect(inboxContentQueryArgs('letter-open', unsealedDelivered)).toEqual({
      letterId: 'letter-open',
    })
  })
})

describe('InboxLetterList', () => {
  it('shows loading then empty then the delivered list without letter bodies', () => {
    const loading = renderWithRouter(
      <InboxLetterList letters={undefined} now={now} timeZone="UTC" />,
    )
    expect(loading.getByRole('heading', { name: '届いた手紙' })).toBeInTheDocument()
    expect(
      loading.getByRole('heading', { name: '届いた手紙' }).closest('[data-status]'),
    ).toHaveAttribute('data-status', 'content-loading')
    loading.unmount()

    const empty = renderWithRouter(<InboxLetterList letters={[]} now={now} timeZone="UTC" />)
    expect(
      empty.getByText(
        'まだ、あなた宛ての手紙は届いていません。今の気持ちを書いて、未来の自分へ届けよう。',
      ),
    ).toBeInTheDocument()
    expect(empty.getByRole('button', { name: '手紙を書く' })).toBeInTheDocument()
    empty.unmount()

    const list = renderWithRouter(
      <InboxLetterList letters={[sealedUnopened, unsealedDelivered]} now={now} timeZone="UTC" />,
    )
    expect(list.getByRole('link', { name: /未開封/ })).toHaveAttribute(
      'href',
      '/letters/letter-sealed',
    )
    expect(list.getByText('未開封')).toBeInTheDocument()
    expect(list.getByText('開封済み')).toBeInTheDocument()
    expect(list.getByText('3日前のあなたから')).toBeInTheDocument()
    expect(list.getByText('今日のあなたから')).toBeInTheDocument()
    expect(list.getByText('今日届きました')).toBeInTheDocument()
    expect(list.queryByText('秘密の本文')).not.toBeInTheDocument()
    expect(list.queryByRole('textbox')).not.toBeInTheDocument()
  })
})

describe('InboxLetterDetail', () => {
  it('asks to open a sealed letter and does not render the body', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn(async () => undefined)

    renderWithRouter(
      <InboxLetterDetail
        attachments={undefined}
        content={{ body: '秘密の本文' }}
        metadata={sealedUnopened}
        now={now}
        onOpen={onOpen}
        openError={null}
        opening={false}
        timeZone="UTC"
      />,
    )

    expect(screen.getByRole('heading', { name: '開封する' })).toBeInTheDocument()
    expect(screen.queryByText('秘密の本文')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'あとで開封する' })).toHaveAttribute('href', '/')
    await user.click(screen.getByRole('button', { name: '開封する' }))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('shows unsealed body as read-only without an open ritual', () => {
    renderWithRouter(
      <InboxLetterDetail
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
        metadata={unsealedDelivered}
        now={now}
        onOpen={async () => undefined}
        openError={null}
        opening={false}
        timeZone="UTC"
      />,
    )

    expect(screen.getByRole('heading', { name: '今日のあなたから' })).toBeInTheDocument()
    expect(screen.getByText('未来の自分へ')).toBeInTheDocument()
    expect(screen.getByText('場所「鴨川」')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '開封する' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('hides traveling letters from the inbox detail route', () => {
    renderWithRouter(
      <InboxLetterDetail
        attachments={undefined}
        content={undefined}
        metadata={{ ...sealedUnopened, status: 'traveling' }}
        now={now}
        onOpen={async () => undefined}
        openError={null}
        opening={false}
        timeZone="UTC"
      />,
    )

    expect(screen.getByRole('heading', { name: '手紙が見つかりません' })).toBeInTheDocument()
  })
})

describe('InboxPhotoList', () => {
  afterEach(() => {
    vi.useRealTimers()
    mockCreateDownloadCapability.mockReset()
  })

  it('ignores a stale capability refresh that fails after a newer one succeeds', async () => {
    vi.useFakeTimers()

    let first!: {
      reject: (error: Error) => void
      resolve: (value: { url: string }) => void
    }
    let second!: {
      reject: (error: Error) => void
      resolve: (value: { url: string }) => void
    }
    mockCreateDownloadCapability
      .mockReturnValueOnce(
        new Promise<{ url: string }>((resolve, reject) => {
          first = { reject, resolve }
        }),
      )
      .mockReturnValueOnce(
        new Promise<{ url: string }>((resolve, reject) => {
          second = { reject, resolve }
        }),
      )

    renderWithRouter(
      <InboxPhotoList photos={[{ attachmentId: 'att-photo', generationToken: 'gen-1' }]} />,
    )

    expect(screen.getByLabelText('添付写真 1を読み込み中')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000)
      second.resolve({ url: 'https://example.test/fresh.jpg' })
    })

    expect(screen.getByRole('img', { name: '添付写真 1' })).toHaveAttribute(
      'src',
      'https://example.test/fresh.jpg',
    )

    await act(async () => {
      first.reject(new Error('stale capability'))
    })

    expect(screen.getByRole('img', { name: '添付写真 1' })).toHaveAttribute(
      'src',
      'https://example.test/fresh.jpg',
    )
  })
})

describe('InboxErrorBoundary', () => {
  it('renders a content error status', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    function Boom(): never {
      throw new Error('inbox query failed')
    }

    render(
      <MantineProvider theme={reMeTheme}>
        <InboxErrorBoundary>
          <Boom />
        </InboxErrorBoundary>
      </MantineProvider>,
    )

    expect(screen.getByRole('alert')).toHaveAttribute('data-status', 'content-error')
    spy.mockRestore()
  })
})
