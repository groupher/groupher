import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

type TProps = {
  children: ReactNode
  title: string
  message: string
  actionLabel: string
  variant: 'flow' | 'page'
  onReset: () => void
}

type TState = {
  failed: boolean
}

export class ErrorBoundary extends Component<TProps, TState> {
  state: TState = { failed: false }

  static getDerivedStateFromError(): TState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Dev Hub render failed.', error, info)
  }

  private handleReset = (): void => {
    this.setState({ failed: false })
    this.props.onReset()
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children

    const { title, message, actionLabel, variant } = this.props

    return (
      <div className={`error-state error-state--${variant}`} role='alert'>
        <AlertTriangle aria-hidden='true' />
        <div className='error-state-copy'>
          <h2>{title}</h2>
          <p>{message}</p>
        </div>
        <button type='button' onClick={this.handleReset}>
          <RotateCcw aria-hidden='true' />
          {actionLabel}
        </button>
      </div>
    )
  }
}
