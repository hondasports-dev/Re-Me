import { useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'

import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import { StatusScreen } from '../../../shared/components/StatusScreen'
import { DeliverySealForm } from '../components/DeliverySealForm'
import { AUTOSAVE_DEBOUNCE_MS, type DeliveryMode } from '../model/compose'

export function ComposeSendPage() {
  const { letterId } = useParams()
  const typedLetterId = letterId as Id<'letters'> | undefined
  const draft = useQuery(api.letters.getDraft, typedLetterId ? { letterId: typedLetterId } : 'skip')
  const saveDraftSettings = useMutation(api.letters.saveDraftSettings)
  const [sealed, setSealed] = useState(true)
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timerRef = useRef<number | undefined>(undefined)
  const hydrated = useRef(false)

  useEffect(() => {
    if (!draft || hydrated.current) {
      return
    }

    hydrated.current = true
    setSealed(draft.sealed)
    setDeliveryMode(draft.deliveryMode)
  }, [draft])

  function scheduleSave(nextSealed: boolean, nextMode: DeliveryMode | null): void {
    if (!typedLetterId || !nextMode) {
      return
    }

    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setSaveStatus('saving')
      void saveDraftSettings({
        letterId: typedLetterId,
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

  if (!typedLetterId || draft === null) {
    return (
      <StatusScreen
        description="この下書きは開けないか、もう送れない手紙です。"
        title="手紙が見つかりません"
        tone="content"
        variant="error"
      />
    )
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

  return (
    <DeliverySealForm
      deliveryMode={deliveryMode}
      onDeliveryModeChange={(mode) => {
        setDeliveryMode(mode)
        scheduleSave(sealed, mode)
      }}
      onSealedChange={(nextSealed) => {
        setSealed(nextSealed)
        scheduleSave(nextSealed, deliveryMode)
      }}
      saveStatus={saveStatus}
      sealed={sealed}
    />
  )
}
