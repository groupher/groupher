import { type FC, useEffect, useState } from 'react'
import { useMutation } from 'urql'
import { ARTICLE_STATE } from '~/const/gtd'
import { POST_STATE_MENU_ITEMS } from '~/const/menu'
import { aliasGTDDoneState } from '~/fmt'
import useKanbanBgColors from '~/hooks/useKanbanBgColors'
import useNameAlias from '~/hooks/useNameAlias'
import useTrans from '~/hooks/useTrans'
import useViewingArticle from '~/hooks/useViewingArticle'
import CheckSVG from '~/icons/CheckBold'
import { toast, updateViewingArticle } from '~/signal'
import { ICON } from '../constant'
import { getGTDColor } from '../helper'
import useSalon, { cn } from '../salon/sub_menu/state_setting'
import S from '../schema'
import useTouched from '../useTouched'
import Footer from './Footer'

type TProps = {
  onBack: () => void
}

const StateSetting: FC<TProps> = ({ onBack }) => {
  const s = useSalon()
  const { t } = useTrans()

  const { article } = useViewingArticle()
  const bgColors = useKanbanBgColors()
  const kanbanAlias = useNameAlias('kanban')

  const [state, setState] = useState(article.state)
  const { touched, setTouched, resetTouched } = useTouched()

  const [result, setPostState] = useMutation(S.setPostState)

  useEffect(() => {
    setState(article.state)
  }, [article.state])

  const handleState = () => {
    const params = {
      article: {
        innerId: article.innerId,
        community: article.communitySlug,
        thread: article.meta.thread,
      },
      state,
    }

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
        const color = getGTDColor(item.key, [...bgColors])

        return (
          <button
            key={item.key}
            className={cn(
              s.item,
              `hover:${s.rainbowSoft(color)}`,
              active && s.rainbowSoft(color),
              index === 4 && 'mt-3.5',
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
              {article.state === ARTICLE_STATE.DONE
                ? t(aliasGTDDoneState(article.cat, item.key))
                : kanbanAlias[ARTICLE_STATE[item.key].toLowerCase()]?.name || t(item.key)}
            </div>
            {active && <CheckSVG className={s.checkIcon} />}
          </button>
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
