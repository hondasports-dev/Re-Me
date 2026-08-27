export const AUTOSAVE_DEBOUNCE_MS = 600

export const deliveryModeOptions = [
  { value: 'few_days', label: '数日後くらい' },
  { value: 'few_weeks', label: '数週間後くらい' },
  { value: 'few_months', label: '数か月後くらい' },
  { value: 'about_year', label: '1年後くらい' },
  { value: 'surprise', label: '未来に任せる' },
] as const

export type DeliveryMode = (typeof deliveryModeOptions)[number]['value']

export const SEND_RITUAL_MS = 900
export const SEND_RITUAL_REDUCED_MS = 50

export function canAdvanceToSend(body: string): boolean {
  return body.trim().length > 0
}

export function canConfirmSend(input: {
  attachmentsReady: boolean
  body: string
  deliveryMode: DeliveryMode | null
  sending: boolean
}): boolean {
  return (
    canAdvanceToSend(input.body) &&
    input.deliveryMode !== null &&
    input.attachmentsReady &&
    !input.sending
  )
}

export function deliveryModeLabel(mode: DeliveryMode): string {
  return deliveryModeOptions.find((option) => option.value === mode)?.label ?? mode
}

export function sendConfirmationSummary(input: {
  body: string
  deliveryMode: DeliveryMode | null
  locationLabel: string | null
  photoCount: number
  sealed: boolean
}): {
  attachmentLabel: string
  bodyPreview: string
  deliveryLabel: string
  sealLabel: string
} {
  const photos = input.photoCount > 0 ? `写真 ${input.photoCount}枚` : '写真なし'
  const location = input.locationLabel ? `場所「${input.locationLabel}」` : '場所なし'

  return {
    attachmentLabel: `${photos} / ${location}`,
    bodyPreview: input.body.trim(),
    deliveryLabel: input.deliveryMode
      ? deliveryModeLabel(input.deliveryMode)
      : 'まだ選んでいません',
    sealLabel: input.sealed ? '封をする' : '封をしない',
  }
}

export function isDraftDirty(localBody: string, savedBody: string): boolean {
  return localBody !== savedBody
}

let blankDraftInflight: Promise<{ letterId: string; threadId: string }> | null = null

export async function startBlankDraft(
  create: () => Promise<{ letterId: string; threadId: string }>,
): Promise<{ letterId: string; threadId: string }> {
  if (!blankDraftInflight) {
    blankDraftInflight = create().finally(() => {
      blankDraftInflight = null
    })
  }

  return await blankDraftInflight
}

export function resetBlankDraftInflight(): void {
  blankDraftInflight = null
}
