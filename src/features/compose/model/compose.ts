export const AUTOSAVE_DEBOUNCE_MS = 600

export const deliveryModeOptions = [
  { value: 'few_days', label: '数日後くらい' },
  { value: 'few_weeks', label: '数週間後くらい' },
  { value: 'few_months', label: '数か月後くらい' },
  { value: 'about_year', label: '1年後くらい' },
  { value: 'surprise', label: '未来に任せる' },
] as const

export type DeliveryMode = (typeof deliveryModeOptions)[number]['value']

export function canAdvanceToSend(body: string): boolean {
  return body.trim().length > 0
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
