import { type FC, useEffect, useState } from 'react'
import { useMutation } from 'urql'

import { ARTICLE_STATUS } from '~/const/gtd'
import { POST_STATUS_MENU_ITEMS } from '~/const/menu'
import { aliasGTDDoneState, toGTDLabelKey } from '~/fmt'
import useKanbanBgColors from '~/hooks/useKanbanBgColors'
import useNameAlias from '~/hooks/useNameAlias'
import useTrans from '~/hooks/useTrans'
import useViewingArticle from '~/hooks/useViewingArticle'
import CheckSVG from '~/icons/CheckBold'
import { toast, updateViewingArticle } from '~/signal'

import { ICON } from '../constant'
import { getGTDColor } from '../helper'
import useSalon, { cn } from '../salon/sub_menu/status_setting'
import S from '../schema'
import useTouched from '../useTouched'
import Footer from './Footer'

type TProps = {
  onBack: () => void
}

const StatusSetting: FC<TProps> = ({ onBack }) => {
  const s = useSalon()
  const { t } = useTrans()

  const { article } = useViewingArticle()
  const bgColors = useKanbanBgColors()
  const kanbanAlias = useNameAlias('kanban')

  const [status, setStatus] = useState(article.status)
  const { touched, setTouched, resetTouched } = useTouched()

  const [result, setPostStatus] = useMutation(S.setPostStatus)

  useEffect(() => {
    setStatus(article.status)
  }, [article.status])

  const handleStatus = () => {
    const params = {
      article: {
        innerId: article.innerId,
        community: article.communitySlug,
        thread: article.meta.thread,
      },
      status,
    }

    setPostStatus(params).then((result) => {
      if (result.error) {
        toast('修改失败', 'error')
      } else {
        toast('修改完成')
        const newStatus = result.data.setPostStatus.status
        setStatus(newStatus)
        updateViewingArticle({ id: article.id, status: newStatus })

        resetTouched()
      }
    })
  }

  return (
    <div className={s.wrapper}>
      {POST_STATUS_MENU_ITEMS.map((item, index) => {
        const TheIcon = ICON[item.key] || ICON[ARTICLE_STATUS.REJECT]
        const active = item.key === status
        const color = getGTDColor(item.key, [...bgColors])

        return (
          <button
            type='button'
            key={item.key}
            className={cn(
              s.item,
              `hover:${s.rainbowSoft(color)}`,
              active && s.rainbowSoft(color),
              index === 4 && 'mt-3.5',
            )}
            onClick={() => {
              setStatus(item.key)
              setTouched(article.status !== item.key)
            }}
          >
            <TheIcon
              className={cn(
                s.icon,
                item.key === ARTICLE_STATUS.WIP && 'size-4 -ml-px',
                `group-hover:${s.rainbow(color, 'fill')}`,
                active && s.rainbow(color, 'fill'),
              )}
            />
            <div className={cn(s.title, active && s.titleActive)}>
              {item.key === ARTICLE_STATUS.DONE
                ? t(aliasGTDDoneState(article.cat, item.key))
                : kanbanAlias[item.key]?.name || t(toGTDLabelKey(item.key))}
            </div>
            {active && <CheckSVG className={s.checkIcon} />}
          </button>
        )
      })}

      <Footer
        onBack={onBack}
        loading={result.fetching}
        disabled={!touched}
        onConfirm={() => handleStatus()}
        top={4}
      />
    </div>
  )
}

export default StatusSetting
