import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { ThreadTimeline } from '../../src/features/thread/components/ThreadTimeline'
import {
  DELETED_SEGMENT_COPY,
  SEALED_SEGMENT_COPY,
  threadSegmentBody,
  threadSegmentHref,
  type ThreadSegmentView,
} from '../../src/features/thread/model/thread'
import { reMeTheme } from '../../src/styles/theme'

const now = Date.UTC(2026, 7, 29, 12, 0, 0)

const opened: ThreadSegmentView = {
  letterId: 'letter-1',
  parentLetterId: null,
  status: 'delivered',
  sealed: true,
  sentAt: Date.UTC(2026, 7, 26, 12, 0, 0),
  deliveredAt: Date.UTC(2026, 7, 29, 3, 0, 0),
  openedAt: Date.UTC(2026, 7, 29, 4, 0, 0),
  deleted: false,
  body: '過去の自分から',
  locationLabel: '鴨川',
}

const sealedTraveling: ThreadSegmentView = {
  letterId: 'letter-2',
  parentLetterId: 'letter-1',
  status: 'traveling',
  sealed: true,
  sentAt: Date.UTC(2026, 7, 29, 5, 0, 0),
  deliveredAt: null,
  openedAt: null,
  deleted: false,
  body: null,
  locationLabel: null,
}

const deleted: ThreadSegmentView = {
  letterId: 'letter-3',
  parentLetterId: 'letter-2',
  status: 'traveling',
  sealed: false,
  sentAt: Date.UTC(2026, 7, 29, 6, 0, 0),
  deliveredAt: null,
  openedAt: null,
  deleted: true,
  body: null,
  locationLabel: null,
}

describe('thread model', () => {
  it('hides deleted and sealed content while keeping timeline hrefs', () => {
    expect(threadSegmentBody(opened)).toBe('過去の自分から')
    expect(threadSegmentBody(sealedTraveling)).toBe(
      '未来を旅しているあいだは、封をした本文は見えません。',
    )
    expect(threadSegmentBody({ ...sealedTraveling, status: 'delivered' })).toBe(SEALED_SEGMENT_COPY)
    expect(threadSegmentBody(deleted)).toBe(DELETED_SEGMENT_COPY)
    expect(threadSegmentHref(opened)).toBe('/letters/letter-1')
    expect(threadSegmentHref(sealedTraveling)).toBe('/traveling/letter-2')
    expect(threadSegmentHref(deleted)).toBeNull()
  })
})

describe('ThreadTimeline', () => {
  it('renders a one-path timeline with a deleted placeholder', () => {
    render(
      <MantineProvider theme={reMeTheme}>
        <MemoryRouter>
          <ThreadTimeline letters={[opened, sealedTraveling, deleted]} now={now} timeZone="UTC" />
        </MemoryRouter>
      </MantineProvider>,
    )

    expect(screen.getByRole('heading', { name: '3日前のあなたから' })).toBeInTheDocument()
    expect(screen.getByText('過去の自分から')).toBeInTheDocument()
    expect(screen.getByText('場所「鴨川」')).toBeInTheDocument()
    expect(
      screen.getByText('未来を旅しているあいだは、封をした本文は見えません。'),
    ).toBeInTheDocument()
    expect(screen.getByText(DELETED_SEGMENT_COPY)).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: 'この手紙をひらく' })
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', '/letters/letter-1')
    expect(links[1]).toHaveAttribute('href', '/traveling/letter-2')
  })
})
