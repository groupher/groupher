import type { FC } from 'react'

import ReplyModeSVG from '~/icons/CommentReplyMode'
import TimelineModeSVG from '~/icons/CommentTimelineMode'
import ArrowSVG from '~/icons/ArrowSolid'

import ExpandSVG from '~/icons/Expand'
import FoldSVG from '~/icons/Fold'

import Tooltip from '~/widgets/Tooltip'

import { MODE } from '../../constant'

import type { TProps as TBase } from '..'

import useLogic from '../../useLogic'
import useSalon, { cn } from '../../styles/head_bar/state_bar/sort_menu'

type TProps = Pick<TBase, 'mode' | 'apiMode' | 'isAllFolded'>

const Actions: FC<TProps> = ({ mode, isAllFolded, apiMode }) => {
  const s = useSalon()

  const { foldAllComments, expandAllComments, onModeChange } = useLogic()

  return (
    <div className={s.wrapper}>
      {isAllFolded ? (
        <div className={cn(s.title, 'mr-3')} onClick={() => expandAllComments()}>
          展开全部
        </div>
      ) : (
        <Tooltip
          content={
            <div className={s.panel}>
              <div className={s.menuItem} onClick={() => onModeChange(MODE.REPLIES)}>
                <ReplyModeSVG className={s.menuIcon} />
                <div className={s.menuTitle}>默认排序</div>
              </div>
              <div className={s.menuItem} onClick={() => onModeChange(MODE.TIMELINE)}>
                <TimelineModeSVG className={s.menuIcon} />
                <div className={s.menuTitle}>时间线排序</div>
              </div>
              <div className={s.menuItem} onClick={() => expandAllComments()}>
                <ExpandSVG className={s.menuIcon} />
                <div className={s.menuTitle}>展开全部</div>
              </div>
              <div className={s.menuItem} onClick={() => foldAllComments()}>
                <FoldSVG className={s.menuIcon} />
                <div className={s.menuTitle}>折叠全部</div>
              </div>
            </div>
          }
          placement="bottom-end"
          trigger="mouseenter focus"
          offset={[-5, 5]}
          noPadding
        >
          <div className={cn(s.title, 'mr-3')}>
            {mode === MODE.REPLIES ? '默认排序' : '时间线排序'}
            <ArrowSVG className={s.arrowIcon} />
          </div>
        </Tooltip>
      )}

      {/* {apiMode === API_MODE.ARTICLE && (
          <IconButton
            icon={SVG.LOCK}
            hint="关闭讨论"
            {...actionIconConfig}
            top={-1}
          />
        )} */}
      {/* {apiMode === API_MODE.ARTICLE && (
          <IconButton
            path="article/notify-on.svg"
            hint="订阅讨论"
            {...actionIconConfig}
          />
        )} */}
    </div>
  )
}

export default Actions
