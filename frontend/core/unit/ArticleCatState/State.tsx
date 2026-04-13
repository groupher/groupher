import type { FC } from 'react'
import { ARTICLE_STATE } from '~/const/gtd'
import { aliasGTDDoneState, toGTDLabelKey } from '~/fmt'
import useNameAlias from '~/hooks/useNameAlias'
import useTrans from '~/hooks/useTrans'
import type { TTooltipPlacement } from '~/spec'
import Tooltip from '~/widgets/Tooltip'

import type { TProps as TArticleStateBadgeProps } from '.'
import useSalon, { Icon } from './salon/state'

type TProps = Pick<TArticleStateBadgeProps, 'cat' | 'state' | 'smaller'>

const tipConfig = {
  placement: 'right' as TTooltipPlacement,
  offset: [0, 0] as [number, number],
  noPadding: true,
}

const State: FC<TProps> = ({ cat, state, smaller }) => {
  const s = useSalon({ cat, state })
  const { t } = useTrans()

  const kanbanAlias = useNameAlias('kanban')

  switch (state) {
    case ARTICLE_STATE.BACKLOG:
    case ARTICLE_STATE.TODO: {
      const stateKey = state.toLowerCase()

      if (smaller) {
        return (
          <Tooltip
            content={
              <div className={s.tipNote}>
                <div className={s.text}>
                  {kanbanAlias[stateKey]?.name || t(toGTDLabelKey(state))}
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
          <div className={s.text}>{kanbanAlias[stateKey]?.name || t(toGTDLabelKey(state))}</div>
        </div>
      )
    }

    case ARTICLE_STATE.WIP: {
      if (smaller) {
        return (
          <Tooltip
            content={
              <div className={s.tipNote}>
                <div className={s.text}>
                  {kanbanAlias[ARTICLE_STATE.WIP]?.name || t(toGTDLabelKey(state))}
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

          <div className={s.text}>
            {kanbanAlias[ARTICLE_STATE.WIP]?.name || t(toGTDLabelKey(state))}
          </div>
        </div>
      )
    }

    case ARTICLE_STATE.DONE: {
      const doneStateKey = aliasGTDDoneState(cat, state)
      if (smaller) {
        return (
          <Tooltip
            content={
              <div className={s.tipNote}>
                <div className={s.text}>{t(doneStateKey)}</div>
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
          <div className={s.text}>{t(doneStateKey)}</div>
        </div>
      )
    }

    case ARTICLE_STATE.REJECT:
    case ARTICLE_STATE.REJECT_STALE:
    case ARTICLE_STATE.REJECT_NO_PLAN:
    case ARTICLE_STATE.REJECT_REPRO:
    case ARTICLE_STATE.REJECT_DUP: {
      const rejectStateKey = state

      if (smaller) {
        return (
          <Tooltip
            content={
              <div className={s.tipNote}>
                <div className={s.text}>{t(toGTDLabelKey(rejectStateKey))}</div>
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
          <div className={s.text}>{t(toGTDLabelKey(rejectStateKey))}</div>
        </div>
      )
    }

    default: {
      return null
    }
  }
}

export default State
