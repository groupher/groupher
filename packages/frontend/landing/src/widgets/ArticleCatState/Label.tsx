import type { FC } from 'react'

import { ARTICLE_CAT } from '~/const/gtd'
import useNameAlias from '~/hooks/useNameAlias'

import type { TProps as TArticleStateBadgeProps } from '.'

import useSalon, { Icon } from './salon/label'

type TProps = Pick<TArticleStateBadgeProps, 'cat' | 'smaller'>

const Label: FC<TProps> = ({ cat, smaller }) => {
  const s = useSalon({ smaller })

  const nameAlias = useNameAlias('kanban')

  switch (cat) {
    case ARTICLE_CAT.FEATURE: {
      return (
        <div className={s.wrapper}>
          <div className={s.iconBox}>
            <Icon.FEATURE className={s.icon} />
          </div>
          <div className={s.text}>{nameAlias[cat.toLowerCase()]?.name}</div>
        </div>
      )
    }

    case ARTICLE_CAT.BUG: {
      return (
        <div className={s.wrapper}>
          <div className={s.iconBox}>
            <Icon.BUG className={s.icon} />
          </div>
          <div className={s.text}>{nameAlias[cat.toLowerCase()]?.name}</div>
        </div>
      )
    }

    case ARTICLE_CAT.QUESTION: {
      return (
        <div className={s.wrapper}>
          <div className={s.iconBox}>
            <Icon.QUESTION className={s.icon} />
          </div>
          <div className={s.text}>{nameAlias[cat.toLowerCase()]?.name}</div>
        </div>
      )
    }

    default:
      return <div className={s.wrapper}>{nameAlias[cat.toLowerCase()]?.name}</div>
  }
}

export default Label
