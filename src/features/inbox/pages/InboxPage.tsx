import { Button } from '@mantine/core'
import { useNavigate } from 'react-router'

import { StatusScreen } from '../../../shared/components/StatusScreen'

export function InboxPage() {
  const navigate = useNavigate()

  return (
    <StatusScreen
      action={
        <Button
          onClick={() => {
            void navigate('/write')
          }}
          type="button"
          variant="light"
        >
          手紙を書く
        </Button>
      }
      description="まだ、あなた宛ての手紙は届いていません。今の気持ちを書いて、未来の自分へ届けよう。"
      title="届いた手紙"
      tone="content"
      variant="empty"
    />
  )
}
