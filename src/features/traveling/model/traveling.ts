export const travelingDeliveryLabels = {
  few_days: '数日後くらい',
  few_weeks: '数週間後くらい',
  few_months: '数か月後くらい',
  about_year: '1年後くらい',
  surprise: '未来に任せる',
} as const

export type TravelingDeliveryMode = keyof typeof travelingDeliveryLabels

export type TravelingLetterMetadata = {
  letterId: string
  sealed: boolean
  deliveryMode: TravelingDeliveryMode | null
  deliveryWindowStart: number | null
  deliveryWindowEnd: number | null
  sentAt: number | null
  status: 'draft' | 'traveling' | 'delivered'
}

export function travelingDeliveryLabel(mode: TravelingDeliveryMode | null): string {
  if (!mode) {
    return '届ける時期はまだ決まっていません'
  }

  return travelingDeliveryLabels[mode]
}

export function travelingSealLabel(sealed: boolean): string {
  return sealed ? '封をしている' : '読み返せる'
}

export function formatDeliveryWindow(
  start: number | null,
  end: number | null,
  timeZone: string,
): string {
  if (start === null || end === null) {
    return '届くころはまだ見えていません'
  }

  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const startLabel = formatter.format(new Date(start))
  const endLabel = formatter.format(new Date(end))

  if (startLabel === endLabel) {
    return `${startLabel}ごろ`
  }

  return `${startLabel} 〜 ${endLabel}ごろ`
}

export function travelingListItemLabel(letter: TravelingLetterMetadata, timeZone: string): string {
  return [
    travelingSealLabel(letter.sealed),
    travelingDeliveryLabel(letter.deliveryMode),
    formatDeliveryWindow(letter.deliveryWindowStart, letter.deliveryWindowEnd, timeZone),
  ].join('、')
}

export function travelingListPhase(
  letters: TravelingLetterMetadata[] | undefined,
): 'loading' | 'empty' | 'list' {
  if (letters === undefined) {
    return 'loading'
  }

  return letters.length === 0 ? 'empty' : 'list'
}

export function canFetchTravelingContent(
  metadata: { sealed: boolean; status: string } | null | undefined,
): boolean {
  return metadata != null && metadata.status === 'traveling' && metadata.sealed === false
}

export function travelingContentQueryArgs<T extends string>(
  letterId: T | undefined,
  metadata: { sealed: boolean; status: string } | null | undefined,
): { letterId: T } | 'skip' {
  if (!letterId || !canFetchTravelingContent(metadata)) {
    return 'skip'
  }

  return { letterId }
}
