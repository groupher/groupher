import type { FC } from 'react'

import { ARTICLE_STATUS } from '~/const/gtd'
import { aliasGTDDoneState, toGTDLabelKey } from '~/fmt'
import useNameAlias from '~/hooks/useNameAlias'
import useTrans from '~/hooks/useTrans'
import type { TTooltipPlacement } from '~/spec'
import Tooltip from '~/widgets/Tooltip'

import type { TProps as TArticleStatusBadgeProps } from '.'
import useSalon, { Icon } from './salon/status'

type TProps = Pick<TArticleStatusBadgeProps, 'cat' | 'status' | 'smaller'>

const tipConfig = {
  placement: 'right' as TTooltipPlacement,
  offset: [0, 0] as [number, number],
  noPadding: true,
}

const Status: FC<TProps> = ({ cat, status, smaller }) => {
  const s = useSalon({ cat, status })
  const { t } = useTrans()

  const kanbanAlias = useNameAlias('kanban')

  switch (status) {
    case ARTICLE_STATUS.BACKLOG:
    case ARTICLE_STATUS.TODO: {
      const statusKey = status.toLowerCase()

      if (smaller) {
        return (
          <Tooltip
            content={
              <div className={s.tipNote}>
                <div className={s.text}>
                  {kanbanAlias[statusKey]?.name || t(toGTDLabelKey(status))}
                </div>
              </div>
            }
            {...tipConfig}
          >
            <div className={s.box}>
              <Icon.Todo className={s.todoIcon} />
            </div>
          </Tooltip>
        )
      }

      return (
        <div className={s.box}>
          <Icon.Todo className={s.todoIcon} />
          <div className={s.text}>{kanbanAlias[statusKey]?.name || t(toGTDLabelKey(status))}</div>
        </div>
      )
    }

    case ARTICLE_STATUS.WIP: {
      const statusKey = status.toLowerCase()

      if (smaller) {
        return (
          <Tooltip
            content={
              <div className={s.tipNote}>
                <div className={s.text}>
                  {kanbanAlias[statusKey]?.name || t(toGTDLabelKey(status))}
                </div>
              </div>
            }
            {...tipConfig}
          >
            <div className={s.box}>
              <Icon.Wip className={s.wipIcon} />
            </div>
          </Tooltip>
        )
      }

      return (
        <div className={s.box}>
          <Icon.Wip className={s.wipIcon} />

          <div className={s.text}>{kanbanAlias[statusKey]?.name || t(toGTDLabelKey(status))}</div>
        </div>
      )
    }

    case ARTICLE_STATUS.DONE: {
      const doneStatusKey = aliasGTDDoneState(cat, status)
      if (smaller) {
        return (
          <Tooltip
            content={
              <div className={s.tipNote}>
                <div className={s.text}>{t(doneStatusKey)}</div>
              </div>
            }
            {...tipConfig}
          >
            <div className={s.box}>
              <Icon.Done className={s.doneIcon} />
            </div>
          </Tooltip>
        )
      }

      return (
        <div className={s.box}>
          {/* <DoneIcon color={doneColor === COLOR.BLACK ? COLOR.GREEN : doneColor} /> */}
          <Icon.Done className={s.doneIcon} />
          <div className={s.text}>{t(doneStatusKey)}</div>
        </div>
      )
    }

    case ARTICLE_STATUS.REJECT:
    case ARTICLE_STATUS.REJECT_STALE:
    case ARTICLE_STATUS.REJECT_NO_PLAN:
    case ARTICLE_STATUS.REJECT_REPRO:
    case ARTICLE_STATUS.REJECT_DUP: {
      const rejectStatusKey = status

      if (smaller) {
        return (
          <Tooltip
            content={
              <div className={s.tipNote}>
                <div className={s.text}>{t(toGTDLabelKey(rejectStatusKey))}</div>
              </div>
            }
            {...tipConfig}
          >
            <div className={s.box}>
              <Icon.Reject className={s.rejectIcon} />
            </div>
          </Tooltip>
        )
      }

      return (
        <div className={s.box}>
          <Icon.Reject className={s.rejectIcon} />
          <div className={s.text}>{t(toGTDLabelKey(rejectStatusKey))}</div>
        </div>
      )
    }

    default: {
      return null
    }
  }
}

export default Status
