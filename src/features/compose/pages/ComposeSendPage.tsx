import { useReducedMotion } from '@mantine/hooks'
import { api, useMutation, useQuery } from '../../../shared/api/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { StatusScreen } from '../../../shared/components/StatusScreen'
import { ComposeUnavailableScreen } from '../components/ComposeUnavailableScreen'
import { DeliverySealForm } from '../components/DeliverySealForm'
import { SendRitual } from '../components/SendRitual'
import {
  AUTOSAVE_DEBOUNCE_MS,
  composeSendPhase,
  flushSettingsThenSend,
  type DeliveryMode,
} from '../model/compose'

type DraftSnapshot = {
  attachmentsReady: boolean
  body: string
  deliveryMode: DeliveryMode | null
  locationLabel: string | null
  sealed: boolean
}

export function ComposeSendPage() {
  const { letterId } = useParams()
  return <ComposeSendSession letterId={letterId as string | undefined} />
}

export function ComposeSendSession({ letterId: typedLetterId }: { letterId: string | undefined }) {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion() ?? false
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [snapshot, setSnapshot] = useState<DraftSnapshot | null>(null)
  const draft = useQuery(
    api.letters.getDraft,
    typedLetterId && !sent && !sending ? { letterId: typedLetterId } : 'skip',
  )
  const metadata = useQuery(
    api.letters.getLetterMetadata,
    typedLetterId && draft === null && !sent && !sending ? { letterId: typedLetterId } : 'skip',
  )
  const finishRitual = useCallback(() => {
    void navigate('/traveling', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (draft) {
      setSnapshot(draft)
    }
  }, [draft])

  const phase = composeSendPhase({
    draft,
    hasLetterId: Boolean(typedLetterId),
    sending,
    sent,
    snapshot,
  })

  if (phase === 'ritual') {
    return <SendRitual onFinished={finishRitual} reducedMotion={reduceMotion} />
  }

  if (phase === 'unavailable') {
    if (typedLetterId && draft === null && metadata === undefined) {
      return (
        <StatusScreen
          description="届ける準備をしています。"
          title="届ける時期と封"
          tone="content"
          variant="loading"
        />
      )
    }

    return (
      <ComposeUnavailableScreen
        sent={metadata?.status === 'traveling' || metadata?.status === 'delivered'}
      />
    )
  }

  if (phase === 'loading' || !typedLetterId) {
    return (
      <StatusScreen
        description="届ける準備をしています。"
        title="届ける時期と封"
        tone="content"
        variant="loading"
      />
    )
  }

  const viewDraft = draft ?? snapshot

  if (!viewDraft) {
    return (
      <StatusScreen
        description="届ける準備をしています。"
        title="届ける時期と封"
        tone="content"
        variant="loading"
      />
    )
  }

  return (
    <LoadedComposeSend
      draft={viewDraft}
      letterId={typedLetterId}
      onSendFailed={() => {
        setSending(false)
      }}
      onSendingStart={() => {
        setSending(true)
      }}
      onSent={() => {
        setSent(true)
      }}
      sending={sending}
    />
  )
}

function LoadedComposeSend({
  draft,
  letterId,
  onSendFailed,
  onSendingStart,
  onSent,
  sending,
}: {
  draft: DraftSnapshot
  letterId: string
  onSendFailed: () => void
  onSendingStart: () => void
  onSent: () => void
  sending: boolean
}) {
  const saveDraftSettings = useMutation(api.letters.saveDraftSettings)
  const sendLetter = useMutation(api.letters.sendLetter)
  const attachments = useQuery(api.attachments.listReadableAttachments, { letterId })
  const [sealed, setSealed] = useState(draft.sealed)
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode | null>(draft.deliveryMode)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [sendError, setSendError] = useState<string | null>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const sendLock = useRef(false)
  const saveChain = useRef(Promise.resolve())

  function enqueueSave(nextSealed: boolean, nextMode: DeliveryMode): Promise<void> {
    saveChain.current = saveChain.current
      .catch(() => undefined)
      .then(async () => {
        await saveDraftSettings({
          letterId,
          sealed: nextSealed,
          deliveryMode: nextMode,
        })
      })
    return saveChain.current
  }

  function scheduleSave(nextSealed: boolean, nextMode: DeliveryMode | null): void {
    if (!nextMode || sending) {
      return
    }

    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setSaveStatus('saving')
      void enqueueSave(nextSealed, nextMode)
        .then(() => {
          setSaveStatus('saved')
        })
        .catch(() => {
          setSaveStatus('error')
        })
    }, AUTOSAVE_DEBOUNCE_MS)
  }

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current)
    }
  }, [])

  async function handleSend(): Promise<void> {
    if (sendLock.current || !deliveryMode || sending) {
      return
    }

    sendLock.current = true
    onSendingStart()
    setSendError(null)
    window.clearTimeout(timerRef.current)

    try {
      await saveChain.current.catch(() => undefined)

      await flushSettingsThenSend({
        saveSettings: async () => {
          await saveDraftSettings({
            letterId,
            sealed,
            deliveryMode,
          })
        },
        sendLetter: async () => {
          await sendLetter({ letterId })
        },
      })
      onSent()
    } catch {
      sendLock.current = false
      onSendFailed()
      setSendError('手紙を未来へ送れませんでした。もう一度お試しください。')
    }
  }

  const photos = (attachments ?? []).filter((attachment) => attachment.kind === 'photo')
  const photosPending =
    attachments === undefined ||
    !draft.attachmentsReady ||
    photos.some((attachment) => attachment.status !== 'ready')
  const photoCount = photos.filter((attachment) => attachment.status === 'ready').length

  return (
    <DeliverySealForm
      body={draft.body}
      deliveryMode={deliveryMode}
      locationLabel={draft.locationLabel}
      onDeliveryModeChange={(mode) => {
        setDeliveryMode(mode)
        scheduleSave(sealed, mode)
      }}
      onSealedChange={(nextSealed) => {
        setSealed(nextSealed)
        scheduleSave(nextSealed, deliveryMode)
      }}
      onSend={() => {
        void handleSend()
      }}
      photoCount={photoCount}
      photosPending={photosPending}
      saveStatus={saveStatus}
      sealed={sealed}
      sendError={sendError}
      sending={sending}
    />
  )
}
