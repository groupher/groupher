import type { FC } from 'react'

import GraveSVG from '~/icons/Grave'
import PlaneSVG from '~/icons/Plane'

import useSalon, { cn } from '../../salon/compare_dev/high_way/block'

type TProps = {
  text: string
  noDot?: boolean
  type?: string
}

const Block: FC<TProps> = ({ text, noDot = false, type = '' }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {type === 'online' && <PlaneSVG className={s.launchIcon} />}
      {type === 'giveup' && <GraveSVG className={s.graveIcon} />}
      {type === '' && (
        <div className={s.buildIcon} role='img' aria-label='wip'>
          🚧
        </div>
      )}
      <div className={cn(s.text, type === 'giveup' && `${s.textRed} bold`)}>{text}</div>
      {!noDot && <div className={s.dot} />}
    </div>
  )
}

export default Block
