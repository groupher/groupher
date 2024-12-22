import { type FC, useState, useEffect } from 'react'
import { useMutation } from 'urql'

import { Trans } from '~/i18n'
import usePrimaryColor from '~/hooks/usePrimaryColor'
import useViewingArticle from '~/hooks/useViewingArticle'
import useKanbanBgColors from '~/hooks/useKanbanBgColors'
import useNameAlias from '~/hooks/useNameAlias'

import { POST_STATE_MENU_ITEMS } from '~/const/menu'
import { ARTICLE_STATE } from '~/const/gtd'
import { toast, updateViewingArticle } from '~/signal'
import { aliasGTDDoneState } from '~/fmt'

import S from '../schema'
import useTouched from '../useTouched'
import Footer from './Footer'
import { getGTDColor } from '../helper'
import { Icon } from '../styles/icon'

import { Wrapper, Item, Divider, Title, CheckIcon } from '../styles/sub_menu/state_setting'

type TProps = {
  onBack: () => void
}

const StateSetting: FC<TProps> = ({ onBack }) => {
  const primaryColor = usePrimaryColor()
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
    <Wrapper>
      {POST_STATE_MENU_ITEMS.map((item, index) => {
        const TheIcon = Icon[item.key] || Icon[ARTICLE_STATE.REJECT]
        const $active = item.key === state
        const $color = getGTDColor(item.key, bgColors)

        return (
          <Item
            $active={$active}
            key={item.key}
            onClick={() => {
              setState(item.key)
              setTouched(article.state !== item.key)
            }}
            $color={$color}
            hasDivider={index === 3}
          >
            {index === 3 && <Divider />}
            {/* @ts-ignore */}
            <TheIcon $active={$active} $color={$color} />
            <Title $active={$active}>
              {article.state === ARTICLE_STATE.DONE ? (
                <>{Trans(aliasGTDDoneState(article.cat, item.key))}</>
              ) : (
                <>{kanbanAlias[ARTICLE_STATE[item.key].toLowerCase()]?.name || Trans(item.key)}</>
              )}
            </Title>
            {$active && <CheckIcon $color={primaryColor} />}
          </Item>
        )
      })}

      <Footer
        onBack={onBack}
        loading={result.fetching}
        disabled={!touched}
        onConfirm={() => handleState()}
        top={12}
        bottom={2}
      />
    </Wrapper>
  )
}

export default StateSetting
