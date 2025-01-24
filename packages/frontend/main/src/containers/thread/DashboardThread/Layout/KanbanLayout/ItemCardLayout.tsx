import { KANBAN_CARD_LAYOUT } from '~/const/layout'

import UpvoteSVG from '~/icons/Upvote'
import CommentSVG from '~/icons/Comment'

import CheckLabel from '~/widgets/CheckLabel'

import { SETTING_FIELD } from '../../constant'
import SectionLabel from '../../SectionLabel'
import SavingBar from '../../SavingBar'

import useKanban from '../../logic/useKanban'
import useSalon, { cn } from '../../salon/layout/kanban_layout/item_card_layout'

export default () => {
  const s = useSalon()

  const { kanbanCardLayout: cardLayout, getKanbanCardLayoutTouched, saving, edit } = useKanban()
  const isTouched = getKanbanCardLayoutTouched()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title="看板卡片布局"
        desc="「看板」卡片的显示样式，只在整体布局为「经典」时有效。"
      />
      <div className={s.select}>
        <div
          className={s.layout}
          onClick={() => edit(KANBAN_CARD_LAYOUT.SIMPLE, 'kanbanCardLayout')}
        >
          <div className={cn(s.block, cardLayout === KANBAN_CARD_LAYOUT.SIMPLE && s.blockActive)}>
            <div className={cn(s.bar, 'w-16')} />
            <div className={cn(s.bar, 'top-8 w-28 h-2.5 opacity-60')} />
            <div className={cn(s.bar, 'bottom-4 right-4 w-10 opacity-30')} />

            <UpvoteSVG className={cn(s.icon, 'bottom-3 left-4')} />
            <CommentSVG className={cn(s.icon, 'size-3.5 bottom-3.5 left-12')} />
          </div>

          <CheckLabel title="简洁" active={cardLayout === KANBAN_CARD_LAYOUT.SIMPLE} top={2} />
        </div>
        <div className={s.layout} onClick={() => edit(KANBAN_CARD_LAYOUT.FULL, 'kanbanCardLayout')}>
          <div className={cn(s.block, cardLayout === KANBAN_CARD_LAYOUT.FULL && s.blockActive)}>
            <div className={cn(s.bar, 'w-16')} />
            <div className={cn(s.bar, 'top-8 w-28 h-2.5 opacity-60')} />

            <div className={cn(s.bar, 'bottom-12 right-4 w-10 mb-1 opacity-20')} />

            <UpvoteSVG className={cn(s.icon, 'bottom-3 left-4')} />
            <div className={cn(s.userAvatar, 'left-10 bottom-3.5')} />
            <div className={cn(s.userAvatar, 'left-16 bottom-3.5 -ml-1 opacity-30')} />
            <div className={cn(s.userAvatar, 'left-20 bottom-3.5 opacity-20')} />

            <CommentSVG className={cn(s.icon, 'size-3.5 bottom-3.5 right-10')} />

            <div className={cn(s.bar, 'w-4 bottom-5 right-4 mt-1 opacity-20')} />
          </div>
          <CheckLabel title="摘要" active={cardLayout === KANBAN_CARD_LAYOUT.FULL} top={2} />
        </div>
      </div>

      <SavingBar
        isTouched={isTouched}
        field={SETTING_FIELD.KANBAN_CARD_LAYOUT}
        loading={saving}
        top={10}
      />
    </div>
  )
}
