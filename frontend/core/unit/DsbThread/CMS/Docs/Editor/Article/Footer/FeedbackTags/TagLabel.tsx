import type { FC } from 'react'

import CheckedSVG from '~/icons/CheckBold'

import useSalon from './salon/tag_label'

type TProps = {
  label: string
  active: boolean
  onClick: () => void
}

const TagLabel: FC<TProps> = ({ label, active, onClick }) => {
  const s = useSalon({ active })

  return (
    <button type='button' className={s.wrapper} aria-pressed={active} onClick={onClick}>
      {active && (
        <span className={s.activeSign}>
          <CheckedSVG className={s.checkIcon} />
        </span>
      )}
      {label}
    </button>
  )
}

export default TagLabel
