import type { FC, MouseEvent } from 'react'

import SlidersHorizontalSVG from '~/icons/SlidersHorizontal'

import type { TDocCoverGroup } from './spec'

type TProps = {
  group: TDocCoverGroup
  className: string
  iconClassName: string
  onEditGroup?: (group: TDocCoverGroup) => void
}

const GroupSettingButton: FC<TProps> = ({ group, className, iconClassName, onEditGroup }) => {
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    onEditGroup?.(group)
  }

  return (
    <button type='button' aria-label='Edit cover group' className={className} onClick={handleClick}>
      <SlidersHorizontalSVG className={iconClassName} />
    </button>
  )
}

export default GroupSettingButton
