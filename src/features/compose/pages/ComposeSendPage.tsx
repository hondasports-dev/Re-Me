import { useReducedMotion } from '@mantine/hooks'
import { useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { StatusScreen } from '../../../shared/components/StatusScreen'
import { ComposeUnavailableScreen } from '../components/ComposeUnavailableScreen'
import { DeliverySealForm } from '../components/DeliverySealForm'
import { SendRitual } from '../components/SendRitual'
import { AUTOSAVE_DEBOUNCE_MS, type DeliveryMode } from '../model/compose'

export function ComposeSendPage() {
  const { letterId } = useParams()
  const typedLetterId = letterId as Id<'letters'> | undefined
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion() ?? false
  const [sent, setSent] = useState(false)
  const draft = useQuery(
    api.letters.getDraft,
    typedLetterId && !sent ? { letterId: typedLetterId } : 'skip',
  )
  const metadata = useQuery(
    api.letters.getLetterMetadata,
    typedLetterId && draft === null && !sent ? { letterId: typedLetterId } : 'skip',
  )
  const finishRitual = useCallback(() => {
    void navigate('/traveling', { replace: true })
  }, [navigate])

  if (sent) {
    return <SendRitual onFinished={finishRitual} reducedMotion={reduceMotion} />
  }

  if (!typedLetterId) {
    return <ComposeUnavailableScreen sent={false} />
  }

  if (draft === undefined) {
    return (
      <StatusScreen
        description="届ける準備をしています。"
        title="届ける時期と封"
        tone="content"
        variant="loading"
      />
    )
  }

  if (draft === null) {
    if (metadata === undefined) {
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

  return <LoadedComposeSend draft={draft} letterId={typedLetterId} onSent={() => setSent(true)} />
}

function LoadedComposeSend({
  draft,
  letterId,
  onSent,
}: {
  draft: {
    body: string
    deliveryMode: DeliveryMode | null
    locationLabel: string | null
    sealed: boolean
  }
  letterId: Id<'letters'>
  onSent: () => void
}) {
  const saveDraftSettings = useMutation(api.letters.saveDraftSettings)
  const sendLetter = useMutation(api.letters.sendLetter)
  const attachments = useQuery(api.attachments.listReadableAttachments, { letterId })
  const [sealed, setSealed] = useState(draft.sealed)
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode | null>(draft.deliveryMode)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [sendError, setSendError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)
  const sendLock = useRef(false)

  function scheduleSave(nextSealed: boolean, nextMode: DeliveryMode | null): void {
    if (!nextMode) {
      return
    }

    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setSaveStatus('saving')
      void saveDraftSettings({
        letterId,
        sealed: nextSealed,
        deliveryMode: nextMode,
      })
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
    setSending(true)
    setSendError(null)
    window.clearTimeout(timerRef.current)

    try {
      await saveDraftSettings({
        letterId,
        sealed,
        deliveryMode,
      })
      await sendLetter({ letterId })
      onSent()
    } catch {
      sendLock.current = false
      setSending(false)
      setSendError('手紙を未来へ送れませんでした。もう一度お試しください。')
    }
  }

  const photos = (attachments ?? []).filter((attachment) => attachment.kind === 'photo')
  const photosPending =
    attachments === undefined || photos.some((attachment) => attachment.status !== 'ready')
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
