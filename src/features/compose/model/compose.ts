export const AUTOSAVE_DEBOUNCE_MS = 600

export const deliveryModeOptions = [
  { value: 'few_days', label: '数日後くらい' },
  { value: 'few_weeks', label: '数週間後くらい' },
  { value: 'few_months', label: '数か月後くらい' },
  { value: 'about_year', label: '1年後くらい' },
  { value: 'surprise', label: '未来に任せる' },
] as const

export type DeliveryMode = (typeof deliveryModeOptions)[number]['value']

export const SEND_RITUAL_MS = 1400
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

export function isLetterNotADraftError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /letter is not a draft/.test(message)
}

export async function flushSettingsThenSend(input: {
  saveSettings: () => Promise<void>
  sendLetter: () => Promise<unknown>
}): Promise<void> {
  try {
    await input.saveSettings()
  } catch (error) {
    if (!isLetterNotADraftError(error)) {
      throw error
    }
  }

  await input.sendLetter()
}

export type ComposeSendPhase = 'ritual' | 'loading' | 'unavailable' | 'form'

export function composeSendPhase(input: {
  draft: unknown | null | undefined
  hasLetterId: boolean
  sending: boolean
  sent: boolean
  snapshot: unknown | null
}): ComposeSendPhase {
  if (input.sent) {
    return 'ritual'
  }

  if (!input.hasLetterId) {
    return 'unavailable'
  }

  if (input.snapshot) {
    return 'form'
  }

  if (input.draft === undefined) {
    return 'loading'
  }

  if (input.draft === null) {
    return 'unavailable'
  }

  return 'form'
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

const replyDraftInflight = new Map<string, Promise<{ letterId: string; threadId: string }>>()

export async function startReplyDraft(
  parentLetterId: string,
  create: () => Promise<{ letterId: string; threadId: string }>,
): Promise<{ letterId: string; threadId: string }> {
  const existing = replyDraftInflight.get(parentLetterId)

  if (existing) {
    return await existing
  }

  const pending = create().finally(() => {
    replyDraftInflight.delete(parentLetterId)
  })
  replyDraftInflight.set(parentLetterId, pending)
  return await pending
}

export function resetReplyDraftInflight(): void {
  replyDraftInflight.clear()
}
