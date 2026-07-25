import type { FC, MouseEvent } from 'react'

import SlidersHorizontalSVG from '~/icons/SlidersHorizontal'

import type { TDocCoverCard } from './spec'

type TProps = {
  section: TDocCoverCard
  className: string
  iconClassName: string
  onEditCard?: (section: TDocCoverCard) => void
}

const GroupSettingButton: FC<TProps> = ({ section, className, iconClassName, onEditCard }) => {
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    onEditCard?.(section)
  }

  return (
    <button type='button' aria-label='Edit cover group' className={className} onClick={handleClick}>
      <SlidersHorizontalSVG className={iconClassName} />
    </button>
  )
}

export default GroupSettingButton
