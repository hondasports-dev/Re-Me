import {
  useMutation as useTanStackMutation,
  useQuery as useTanStackQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useCallback } from 'react'

import { useApiClient } from './client'
import type {
  ApiAttachment,
  ApiDownloadCapability,
  ApiDraft,
  ApiLetterMetadata,
  ApiPhotoIntent,
  ApiPushConfig,
  ApiPushDisableResult,
  ApiPushStatus,
  ApiSentLetter,
  ApiThread,
  ApiUser,
  DeliveryMode,
} from './types'

export interface ApiEndpoint<TArgs, _TResult> {
  key: string
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  path: (args: TArgs) => string
  body?: (args: TArgs) => unknown
}

export const api = {
  users: {
    me: endpoint<void, ApiUser | null>('users.me', 'GET', () => '/api/users/me'),
    ensureCurrentUser: endpoint<Record<string, never>, ApiUser>(
      'users.ensureCurrentUser',
      'POST',
      () => '/api/users/ensure',
      () => ({}),
    ),
  },
  letters: {
    createDraft: endpoint<{ parentLetterId?: string }, { letterId: string; threadId: string }>(
      'letters.createDraft',
      'POST',
      () => '/api/letters/drafts',
      (args) => args,
    ),
    saveDraft: endpoint<{ letterId: string; body: string }, null>(
      'letters.saveDraft',
      'PATCH',
      (args) => `/api/letters/${encodeURIComponent(args.letterId)}/draft`,
      (args) => ({ body: args.body }),
    ),
    getDraft: endpoint<{ letterId: string }, ApiDraft | null>(
      'letters.getDraft',
      'GET',
      (args) => `/api/letters/${encodeURIComponent(args.letterId)}/draft`,
    ),
    saveDraftSettings: endpoint<
      { letterId: string; sealed: boolean; deliveryMode: DeliveryMode },
      null
    >(
      'letters.saveDraftSettings',
      'PATCH',
      (args) => `/api/letters/${encodeURIComponent(args.letterId)}/settings`,
      (args) => ({ sealed: args.sealed, deliveryMode: args.deliveryMode }),
    ),
    sendLetter: endpoint<{ letterId: string }, ApiSentLetter>(
      'letters.sendLetter',
      'POST',
      (args) => `/api/letters/${encodeURIComponent(args.letterId)}/send`,
    ),
    getLetterMetadata: endpoint<{ letterId: string }, ApiLetterMetadata | null>(
      'letters.getLetterMetadata',
      'GET',
      (args) => `/api/letters/${encodeURIComponent(args.letterId)}/metadata`,
    ),
    listTravelingLetters: endpoint<void, ApiLetterMetadata[]>(
      'letters.listTravelingLetters',
      'GET',
      () => '/api/letters?status=traveling',
    ),
    listDeliveredLetters: endpoint<void, ApiLetterMetadata[]>(
      'letters.listDeliveredLetters',
      'GET',
      () => '/api/letters?status=delivered',
    ),
    deleteLetter: endpoint<{ letterId: string }, null>(
      'letters.deleteLetter',
      'DELETE',
      (args) => `/api/letters/${encodeURIComponent(args.letterId)}`,
    ),
    getReadableContent: endpoint<{ letterId: string }, { letterId: string; body: string } | null>(
      'letters.getReadableContent',
      'GET',
      (args) => `/api/letters/${encodeURIComponent(args.letterId)}/content`,
    ),
    openLetter: endpoint<{ letterId: string }, { letterId: string; openedAt: number }>(
      'letters.openLetter',
      'POST',
      (args) => `/api/letters/${encodeURIComponent(args.letterId)}/open`,
    ),
    forceDeliverOwnLetter: endpoint<
      { letterId: string },
      { letterId: string; deliveredAt: number }
    >(
      'letters.forceDeliverOwnLetter',
      'POST',
      (args) => `/api/letters/${encodeURIComponent(args.letterId)}/force-deliver`,
    ),
  },
  attachments: {
    listReadableAttachments: endpoint<{ letterId: string }, ApiAttachment[] | null>(
      'attachments.listReadableAttachments',
      'GET',
      (args) => `/api/letters/${encodeURIComponent(args.letterId)}/attachments`,
    ),
    createAttachmentIntent: endpoint<
      { letterId: string; mimeType: string; byteSize: number; width: number; height: number },
      ApiPhotoIntent
    >(
      'attachments.createAttachmentIntent',
      'POST',
      (args) => `/api/letters/${encodeURIComponent(args.letterId)}/attachments/intents`,
      (args) => ({
        mimeType: args.mimeType,
        byteSize: args.byteSize,
        width: args.width,
        height: args.height,
      }),
    ),
    removeDraftPhoto: endpoint<{ attachmentId: string; generationToken: string }, null>(
      'attachments.removeDraftPhoto',
      'DELETE',
      (args) =>
        `/api/attachments/${encodeURIComponent(args.attachmentId)}?generationToken=${encodeURIComponent(args.generationToken)}`,
    ),
    setDraftLocation: endpoint<
      { letterId: string; locationLabel: string },
      { locationLabel: string }
    >(
      'attachments.setDraftLocation',
      'POST',
      (args) => `/api/letters/${encodeURIComponent(args.letterId)}/location`,
      (args) => ({ locationLabel: args.locationLabel }),
    ),
    removeDraftLocation: endpoint<{ letterId: string }, null>(
      'attachments.removeDraftLocation',
      'DELETE',
      (args) => `/api/letters/${encodeURIComponent(args.letterId)}/location`,
    ),
    finalizeAttachment: endpoint<
      { attachmentId: string; generationToken: string },
      { attachmentId: string }
    >(
      'attachments.finalizeAttachment',
      'POST',
      (args) => `/api/attachments/${encodeURIComponent(args.attachmentId)}/finalize`,
      (args) => ({ generationToken: args.generationToken }),
    ),
    createAttachmentDownloadCapability: endpoint<
      { attachmentId: string; generationToken: string },
      ApiDownloadCapability | null
    >(
      'attachments.createAttachmentDownloadCapability',
      'POST',
      (args) => `/api/attachments/${encodeURIComponent(args.attachmentId)}/download-capability`,
      (args) => ({ generationToken: args.generationToken }),
    ),
  },
  threads: {
    getThread: endpoint<{ threadId: string }, ApiThread | null>(
      'threads.getThread',
      'GET',
      (args) => `/api/threads/${encodeURIComponent(args.threadId)}`,
    ),
  },
  pushSubscriptions: {
    getConfig: endpoint<void, ApiPushConfig>(
      'pushSubscriptions.getConfig',
      'GET',
      () => '/api/push/config',
    ),
    getMyPushStatus: endpoint<{ endpoint?: string }, ApiPushStatus>(
      'pushSubscriptions.getMyPushStatus',
      'GET',
      (args) =>
        args.endpoint
          ? `/api/push/status?endpoint=${encodeURIComponent(args.endpoint)}`
          : '/api/push/status',
    ),
    upsertMine: endpoint<
      { auth: string; endpoint: string; p256dh: string; userAgent?: string },
      ApiPushStatus
    >(
      'pushSubscriptions.upsertMine',
      'PUT',
      () => '/api/push/subscriptions',
      (args) => args,
    ),
    disableMine: endpoint<{ endpoint: string }, ApiPushDisableResult>(
      'pushSubscriptions.disableMine',
      'DELETE',
      (args) => `/api/push/subscriptions?endpoint=${encodeURIComponent(args.endpoint)}`,
    ),
  },
} as const

export function useQuery<TArgs, TResult>(
  endpoint: ApiEndpoint<TArgs, TResult>,
  args?: TArgs | 'skip',
): TResult | undefined {
  const client = useApiClient()
  const normalizedArgs = args === 'skip' ? undefined : args
  const enabled = args !== 'skip'
  const query = useTanStackQuery({
    queryKey: [endpoint.key, normalizedArgs ?? null],
    queryFn: async () => {
      const body =
        endpoint.body && normalizedArgs !== undefined
          ? JSON.stringify(endpoint.body(normalizedArgs))
          : undefined
      return await client.request<TResult>(endpoint.path((normalizedArgs ?? undefined) as TArgs), {
        method: endpoint.method,
        ...(body === undefined ? {} : { body }),
      })
    },
    enabled,
    retry: false,
  })
  return query.data
}

export function useMutation<TArgs, TResult>(
  endpoint: ApiEndpoint<TArgs, TResult>,
): (args: TArgs) => Promise<TResult> {
  const client = useApiClient()
  const queryClient = useQueryClient()
  const mutation = useTanStackMutation({
    mutationFn: async (args: TArgs) => {
      const body = endpoint.body ? JSON.stringify(endpoint.body(args)) : undefined
      return await client.request<TResult>(endpoint.path(args), {
        method: endpoint.method,
        ...(body === undefined ? {} : { body }),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries()
    },
  })
  return useCallback((args: TArgs) => mutation.mutateAsync(args), [mutation.mutateAsync])
}

export const useAction = useMutation

function endpoint<TArgs, TResult>(
  key: string,
  method: ApiEndpoint<TArgs, TResult>['method'],
  path: (args: TArgs) => string,
  body?: (args: TArgs) => unknown,
): ApiEndpoint<TArgs, TResult> {
  return { key, method, path, ...(body ? { body } : {}) }
}
