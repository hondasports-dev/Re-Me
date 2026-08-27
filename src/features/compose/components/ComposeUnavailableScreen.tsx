import { StatusScreen } from '../../../shared/components/StatusScreen'

export function ComposeUnavailableScreen({ sent }: { sent: boolean }) {
  return (
    <StatusScreen
      description={
        sent
          ? '送信後の本文・添付・配送設定は変えられません。'
          : 'この下書きは開けないか、もう送れない手紙です。'
      }
      title={sent ? 'この手紙はもう送れません' : '手紙が見つかりません'}
      tone="content"
      variant="error"
    />
  )
}
