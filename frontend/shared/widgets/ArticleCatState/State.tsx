import type { FC } from 'react'

import type { TTooltipPlacement } from '~/spec'
import { ARTICLE_STATE } from '~/const/gtd'
import useNameAlias from '~/hooks/useNameAlias'

import Tooltip from '~/widgets/Tooltip'

import { Trans } from '~/i18n'
import { aliasGTDDoneState } from '~/fmt'

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

  const kanbanAlias = useNameAlias('kanban')

  switch (state) {
    case ARTICLE_STATE.TODO: {
      if (smaller) {
        return (
          <Tooltip
            content={
              <div className={s.tipNote}>
                <div className={s.text}>{kanbanAlias[ARTICLE_STATE.TODO.toLowerCase()].name}</div>
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
          <div className={s.text}>{kanbanAlias[ARTICLE_STATE.TODO.toLowerCase()].name}</div>
        </div>
      )
    }

    case ARTICLE_STATE.WIP: {
      if (smaller) {
        return (
          <Tooltip
            content={
              <div className={s.tipNote}>
                <div className={s.text}>{kanbanAlias[ARTICLE_STATE.WIP.toLowerCase()].name}</div>
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

          <div className={s.text}>{kanbanAlias[ARTICLE_STATE.WIP.toLowerCase()].name}</div>
        </div>
      )
    }

    case ARTICLE_STATE.DONE: {
      if (smaller) {
        return (
          <Tooltip
            content={
              <div className={s.tipNote}>
                <div className={s.text}>{Trans(aliasGTDDoneState(cat, state))}</div>
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
          {/* <DoneIcon color={doneColor === COLOR_NAME.BLACK ? COLOR_NAME.GREEN : doneColor} /> */}
          <Icon.Done className={s.doneIcon} />
          <div className={s.text}>{Trans(aliasGTDDoneState(cat, state))}</div>
        </div>
      )
    }

    case ARTICLE_STATE.REJECT:
    case ARTICLE_STATE.REJECT_STALE:
    case ARTICLE_STATE.REJECT_NO_PLAN:
    case ARTICLE_STATE.REJECT_REPRO:
    case ARTICLE_STATE.REJECT_DUP: {
      if (smaller) {
        return (
          <Tooltip
            content={
              <div className={s.tipNote}>
                <div className={s.text}>{Trans(state)}</div>
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
          <div className={s.text}>{Trans(state)}</div>
        </div>
      )
    }

    default: {
      return null
    }
  }
}

export default State
