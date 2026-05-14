import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSolid'
import ReplyModeSVG from '~/icons/CommentReplyMode'
import TimelineModeSVG from '~/icons/CommentTimelineMode'
import ExpandSVG from '~/icons/Expand'
import FoldSVG from '~/icons/Fold'
import Tooltip from '~/widgets/Tooltip'

import type { TProps as TBase } from '..'
import { MODE } from '../../constant'
import useSalon, { cn } from '../../salon/head_bar/state_bar/sort_menu'
import useActions from '../../useLogic/useActions'

type TProps = Pick<TBase, 'mode' | 'apiMode' | 'isAllFolded'>

const Actions: FC<TProps> = ({ mode, isAllFolded, apiMode: _apiMode }) => {
  const s = useSalon()

  const { foldAllComments, expandAllComments, onModeChange } = useActions()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      {isAllFolded ? (
        <button type='button' className={cn(s.title, 'mr-3')} onClick={() => expandAllComments()}>
          {t('comment.sort.expand_all')}
        </button>
      ) : (
        <Tooltip
          content={
            <div className={s.panel}>
              <button
                type='button'
                className={s.menuItem}
                onClick={() => onModeChange(MODE.REPLIES)}
              >
                <ReplyModeSVG className={s.menuIcon} />
                <div className={s.menuTitle}>{t('comment.sort.default')}</div>
              </button>
              <button
                type='button'
                className={s.menuItem}
                onClick={() => onModeChange(MODE.TIMELINE)}
              >
                <TimelineModeSVG className={s.menuIcon} />
                <div className={s.menuTitle}>{t('comment.sort.timeline')}</div>
              </button>
              <button type='button' className={s.menuItem} onClick={() => expandAllComments()}>
                <ExpandSVG className={s.menuIcon} />
                <div className={s.menuTitle}>{t('comment.sort.expand_all')}</div>
              </button>
              <button type='button' className={s.menuItem} onClick={() => foldAllComments()}>
                <FoldSVG className={s.menuIcon} />
                <div className={s.menuTitle}>{t('comment.sort.fold_all')}</div>
              </button>
            </div>
          }
          placement='bottom-end'
          trigger='mouseenter focus'
          offset={[-5, 5]}
          noPadding
        >
          <div className={cn(s.title, 'mr-3')}>
            {mode === MODE.REPLIES ? t('comment.sort.default') : t('comment.sort.timeline')}
            <ArrowSVG className={s.arrowIcon} />
          </div>
        </Tooltip>
      )}

      {/* {_apiMode === API_MODE.ARTICLE && (
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
