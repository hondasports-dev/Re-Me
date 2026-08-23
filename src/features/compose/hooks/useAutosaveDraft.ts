import { useCallback, useEffect, useRef, useState } from 'react'

import { AUTOSAVE_DEBOUNCE_MS, isDraftDirty } from '../model/compose'

export type DraftSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useAutosaveDraft(
  savedBody: string | undefined,
  save: (body: string) => Promise<void>,
): {
  body: string
  saveStatus: DraftSaveStatus
  setBody: (body: string) => void
  flush: () => Promise<void>
} {
  const [body, setBodyState] = useState(savedBody ?? '')
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>('idle')
  const bodyRef = useRef(body)
  const savedBodyRef = useRef(savedBody ?? '')
  const saveRef = useRef(save)
  const timerRef = useRef<number | undefined>(undefined)

  bodyRef.current = body
  saveRef.current = save

  useEffect(() => {
    if (savedBody === undefined) {
      return
    }

    savedBodyRef.current = savedBody
    setBodyState((current) => (isDraftDirty(current, savedBodyRef.current) ? current : savedBody))
  }, [savedBody])

  const flush = useCallback(async (): Promise<void> => {
    window.clearTimeout(timerRef.current)

    if (!isDraftDirty(bodyRef.current, savedBodyRef.current)) {
      return
    }

    setSaveStatus('saving')

    try {
      await saveRef.current(bodyRef.current)
      savedBodyRef.current = bodyRef.current
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
      throw new Error('draft_save_failed')
    }
  }, [])

  const setBody = useCallback(
    (next: string) => {
      setBodyState(next)
      setSaveStatus('idle')
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        void flush().catch(() => undefined)
      }, AUTOSAVE_DEBOUNCE_MS)
    },
    [flush],
  )

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent): void {
      if (!isDraftDirty(bodyRef.current, savedBodyRef.current)) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.clearTimeout(timerRef.current)
    }
  }, [])

  return { body, saveStatus, setBody, flush }
}
