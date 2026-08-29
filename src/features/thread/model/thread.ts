import { fromYouLabel } from '../../inbox/model/inbox'

export const DELETED_SEGMENT_COPY = 'この手紙は削除されています'
export const SEALED_SEGMENT_COPY = '封をした手紙は、開封するまで本文を見えません。'
export const TRAVELING_SEALED_COPY = '未来を旅しているあいだは、封をした本文は見えません。'

export type ThreadSegmentView = {
  letterId: string
  parentLetterId: string | null
  status: 'draft' | 'traveling' | 'delivered'
  sealed: boolean
  sentAt: number | null
  deliveredAt: number | null
  openedAt: number | null
  deleted: boolean
  body: string | null
  locationLabel: string | null
}

export function threadSegmentHref(segment: ThreadSegmentView): string | null {
  if (segment.deleted) {
    return null
  }

  if (segment.status === 'delivered') {
    return `/letters/${segment.letterId}`
  }

  if (segment.status === 'traveling') {
    return `/traveling/${segment.letterId}`
  }

  return null
}

export function threadSegmentLabel(
  segment: ThreadSegmentView,
  now: number,
  timeZone: string,
): string {
  return fromYouLabel(segment.sentAt, now, timeZone)
}

export function threadSegmentBody(segment: ThreadSegmentView): string | null {
  if (segment.deleted) {
    return DELETED_SEGMENT_COPY
  }

  if (segment.body !== null) {
    return segment.body
  }

  if (segment.status === 'traveling' && segment.sealed) {
    return TRAVELING_SEALED_COPY
  }

  if (segment.sealed) {
    return SEALED_SEGMENT_COPY
  }

  return null
}
