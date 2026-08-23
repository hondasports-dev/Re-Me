import { useMutation } from 'convex/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { api } from '../../../../convex/_generated/api'
import { StatusScreen } from '../../../shared/components/StatusScreen'
import { startBlankDraft } from '../model/compose'

export function ComposePage() {
  const createDraft = useMutation(api.letters.createDraft)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void startBlankDraft(() => createDraft({}))
      .then((created) => {
        if (!cancelled) {
          void navigate(`/write/${created.letterId}`, { replace: true })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('下書きを用意できませんでした。もう一度お試しください。')
        }
      })

    return () => {
      cancelled = true
    }
  }, [createDraft, navigate])

  if (error) {
    return (
      <StatusScreen
        description={error}
        title="手紙を書けませんでした"
        tone="content"
        variant="error"
      />
    )
  }

  return (
    <StatusScreen
      description="便箋をひらいて、今の気持ちを残せるようにしています。"
      title="手紙を書く"
      tone="content"
      variant="loading"
    />
  )
}
