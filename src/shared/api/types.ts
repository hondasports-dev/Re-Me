export type LetterStatus = 'draft' | 'traveling' | 'delivered'
export type DeliveryMode = 'few_days' | 'few_weeks' | 'few_months' | 'about_year' | 'surprise'
export type AttachmentStatus = 'pending' | 'ready' | 'deleting'

export interface ApiUser {
  userId: string
  email?: string
  name?: string
  pictureUrl?: string
}

export interface ApiLetterMetadata {
  letterId: string
  threadId: string
  parentLetterId: string | null
  nextLetterId: string | null
  status: LetterStatus
  sealed: boolean
  deliveryMode: DeliveryMode | null
  deliveryWindowStart: number | null
  deliveryWindowEnd: number | null
  sentAt: number | null
  deliveredAt: number | null
  openedAt: number | null
  repliedAt: number | null
  createdAt: number
  updatedAt: number
}

export interface ApiDraft {
  letterId: string
  threadId: string
  sealed: boolean
  deliveryMode: DeliveryMode | null
  body: string
  locationLabel: string | null
  attachmentsReady: boolean
}

export interface ApiAttachment {
  attachmentId: string
  kind: 'photo' | 'location'
  status: AttachmentStatus
  generationToken: string | null
  mimeType: string | null
  byteSize: number | null
  width: number | null
  height: number | null
  locationLabel: string | null
}

export interface ApiThreadSegment {
  letterId: string
  parentLetterId: string | null
  status: LetterStatus
  sealed: boolean
  sentAt: number | null
  deliveredAt: number | null
  openedAt: number | null
  deleted: boolean
  body: string | null
  locationLabel: string | null
}

export interface ApiThread {
  threadId: string
  letters: ApiThreadSegment[]
}

export interface ApiSentLetter {
  letterId: string
  threadId: string
  status: 'traveling'
  sealed: boolean
  deliveryMode: DeliveryMode
  deliveryWindowStart: number
  deliveryWindowEnd: number
  sentAt: number
}

export interface ApiPushStatus {
  enabled: boolean
}

export interface ApiPushConfig {
  publicKey: string | null
}

export interface ApiPushDisableResult {
  enabled: false
  owned: boolean
}

export interface ApiPhotoIntent {
  attachmentId: string
  generationToken: string
  uploadUrl: string
  expiresAt: number
}

export interface ApiDownloadCapability {
  url: string
  expiresAt: number
}
