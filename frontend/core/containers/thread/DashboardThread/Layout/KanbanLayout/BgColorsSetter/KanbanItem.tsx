import type { FC } from 'react'

import UpvoteSVG from '~/icons/Upvote'

import useSalon, { cnMerge } from '../../../salon/layout/kanban_layout/bg_colors_setter/kanban_item'

type TProps = {
  opacity?: string
  width?: string
}

const KanbanItem: FC<TProps> = ({ opacity = 'opacity-100', width = 'w-20' }) => {
  const s = useSalon()

  return (
    <div className={cnMerge(s.wrapper, opacity)}>
      <div className={cnMerge(s.bar, 'top-2 w-14 mt-0.5 opacity-20')} />
      <div className={cnMerge(s.bar, 'top-5 h-1.5 opacity-30', width)} />

      <UpvoteSVG className={s.icon} />
      <div className={cnMerge(s.bar, 'bottom-2 left-6 h-1 w-6 opacity-10')} />
    </div>
  )
}

export default KanbanItem
