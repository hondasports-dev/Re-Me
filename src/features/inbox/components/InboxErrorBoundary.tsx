import { Component, type ReactNode } from 'react'

import { StatusScreen } from '../../../shared/components/StatusScreen'

export class InboxErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <StatusScreen
          description="届いた手紙を読み込めませんでした。時間をおいてもう一度お試しください。"
          title="手紙を表示できません"
          tone="content"
          variant="error"
        />
      )
    }

    return this.props.children
  }
}
