import { List, Workflow } from 'lucide-react'

import type { THubViewMode } from '@/spec'

type TProps = {
  value: THubViewMode
  onChange: (mode: THubViewMode) => void
}

const OPTIONS: { value: THubViewMode; label: string; icon: typeof List }[] = [
  { value: 'list', label: 'List', icon: List },
  { value: 'flow', label: 'Flow', icon: Workflow },
]

export function ViewModeSwitch({ value, onChange }: TProps) {
  return (
    <div className='view-mode-switch' role='radiogroup' aria-label='Service view'>
      {OPTIONS.map((option) => {
        const Icon = option.icon
        const active = value === option.value

        return (
          <button
            key={option.value}
            type='button'
            className={active ? 'is-active' : ''}
            role='radio'
            aria-checked={active}
            aria-label={`${option.label} view`}
            title={option.label}
            onClick={() => onChange(option.value)}
          >
            <Icon aria-hidden='true' />
          </button>
        )
      })}
    </div>
  )
}
