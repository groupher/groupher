import { type FC, useState, useEffect } from 'react'
import { useMutation } from 'urql'

import { Trans } from '~/i18n'
import useViewingArticle from '~/hooks/useViewingArticle'
import useKanbanBgColors from '~/hooks/useKanbanBgColors'
import useNameAlias from '~/hooks/useNameAlias'

import { ICON } from '../constant'
import CheckSVG from '~/icons/CheckBold'

import { POST_STATE_MENU_ITEMS } from '~/const/menu'
import { ARTICLE_STATE } from '~/const/gtd'
import { toast, updateViewingArticle } from '~/signal'
import { aliasGTDDoneState } from '~/fmt'

import S from '../schema'
import useTouched from '../useTouched'
import Footer from './Footer'
import { getGTDColor } from '../helper'

import useSalon, { cn } from '../salon/sub_menu/state_setting'

type TProps = {
  onBack: () => void
}

const StateSetting: FC<TProps> = ({ onBack }) => {
  const s = useSalon()

  const { article } = useViewingArticle()
  const bgColors = useKanbanBgColors()
  const kanbanAlias = useNameAlias('kanban')

  const [state, setState] = useState(article.state)
  const { touched, setTouched, resetTouched } = useTouched()

  const [result, setPostState] = useMutation(S.setPostState)

  useEffect(() => {
    setState(article.state)
  }, [])

  const handleState = () => {
    const params = { id: article.id, state }
    setPostState(params).then((result) => {
      if (result.error) {
        toast('修改失败', 'error')
      } else {
        toast('修改完成')
        const newState = result.data.setPostState.state
        setState(newState)
        updateViewingArticle({ id: article.id, state: newState })

        resetTouched()
      }
    })
  }

  return (
    <div className={s.wrapper}>
      {POST_STATE_MENU_ITEMS.map((item, index) => {
        const TheIcon = ICON[item.key] || ICON[ARTICLE_STATE.REJECT]
        const active = item.key === state
        const color = getGTDColor(item.key, bgColors)

        return (
          <div
            key={item.key}
            className={cn(
              s.item,
              `hover:${s.rainbowSoft(color)}`,
              active && s.rainbowSoft(color),
              index === 3 && 'mt-3.5',
            )}
            onClick={() => {
              setState(item.key)
              setTouched(article.state !== item.key)
            }}
          >
            <TheIcon
              className={cn(
                s.icon,
                item.key === ARTICLE_STATE.WIP && 'size-4 -ml-px',
                `group-hover:${s.rainbow(color, 'fill')}`,
                active && s.rainbow(color, 'fill'),
              )}
            />
            <div className={cn(s.title, active && s.titleActive)}>
              {article.state === ARTICLE_STATE.DONE ? (
                <>{Trans(aliasGTDDoneState(article.cat, item.key))}</>
              ) : (
                <>{kanbanAlias[ARTICLE_STATE[item.key].toLowerCase()]?.name || Trans(item.key)}</>
              )}
            </div>
            {active && <CheckSVG className={s.checkIcon} />}
          </div>
        )
      })}

      <Footer
        onBack={onBack}
        loading={result.fetching}
        disabled={!touched}
        onConfirm={() => handleState()}
        top={4}
      />
    </div>
  )
}

export default StateSetting
