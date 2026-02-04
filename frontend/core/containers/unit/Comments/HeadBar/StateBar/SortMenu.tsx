import type { FC } from 'react'

import ReplyModeSVG from '~/icons/CommentReplyMode'
import TimelineModeSVG from '~/icons/CommentTimelineMode'
import ArrowSVG from '~/icons/ArrowSolid'

import ExpandSVG from '~/icons/Expand'
import FoldSVG from '~/icons/Fold'

import Tooltip from '~/widgets/Tooltip'
import useTrans from '~/hooks/useTrans'

import { MODE } from '../../constant'

import type { TProps as TBase } from '..'

import useLogic from '../../useLogic'
import useSalon, { cn } from '../../salon/head_bar/state_bar/sort_menu'

type TProps = Pick<TBase, 'mode' | 'apiMode' | 'isAllFolded'>

const Actions: FC<TProps> = ({ mode, isAllFolded, apiMode }) => {
  const s = useSalon()

  const { foldAllComments, expandAllComments, onModeChange } = useLogic()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      {isAllFolded ? (
        <div className={cn(s.title, 'mr-3')} onClick={() => expandAllComments()}>
          {t('comment.sort.expand_all')}
        </div>
      ) : (
        <Tooltip
          content={
            <div className={s.panel}>
              <div className={s.menuItem} onClick={() => onModeChange(MODE.REPLIES)}>
                <ReplyModeSVG className={s.menuIcon} />
                <div className={s.menuTitle}>{t('comment.sort.default')}</div>
              </div>
              <div className={s.menuItem} onClick={() => onModeChange(MODE.TIMELINE)}>
                <TimelineModeSVG className={s.menuIcon} />
                <div className={s.menuTitle}>{t('comment.sort.timeline')}</div>
              </div>
              <div className={s.menuItem} onClick={() => expandAllComments()}>
                <ExpandSVG className={s.menuIcon} />
                <div className={s.menuTitle}>{t('comment.sort.expand_all')}</div>
              </div>
              <div className={s.menuItem} onClick={() => foldAllComments()}>
                <FoldSVG className={s.menuIcon} />
                <div className={s.menuTitle}>{t('comment.sort.fold_all')}</div>
              </div>
            </div>
          }
          placement="bottom-end"
          trigger="mouseenter focus"
          offset={[-5, 5]}
          noPadding
        >
          <div className={cn(s.title, 'mr-3')}>
            {mode === MODE.REPLIES ? t('comment.sort.default') : t('comment.sort.timeline')}
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
