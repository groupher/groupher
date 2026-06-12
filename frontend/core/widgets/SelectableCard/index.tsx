import type { ReactNode } from 'react'

import CheckedSVG from '~/icons/CheckBold'

import useSalon, { cnMerge } from './salon'

type TProps = {
  children: ReactNode
  active: boolean
  ariaLabel: string
  className?: string
  contentClassName?: string
  disabled?: boolean
  isCircle?: boolean
  onClick: () => void
}

export default function SelectableCard({
  children,
  active,
  ariaLabel,
  className,
  contentClassName,
  disabled = false,
  isCircle = false,
  onClick,
}: TProps) {
  const s = useSalon({ active, disabled, isCircle })

  return (
    <button
      type='button'
      className={cnMerge(s.wrapper, className)}
      aria-label={ariaLabel}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {active && (
        <span className={s.activeSign}>
          <CheckedSVG className={s.checkIcon} />
        </span>
      )}
      <span className={cnMerge(s.content, contentClassName)}>{children}</span>
    </button>
  )
}
