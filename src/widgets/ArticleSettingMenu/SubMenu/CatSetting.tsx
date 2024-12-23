import { type FC, useState, useEffect } from 'react'
import { useMutation } from 'urql'

import useViewingArticle from '~/hooks/useViewingArticle'
import { POST_CAT_MENU_ITEMS } from '~/const/menu'
import { Trans } from '~/i18n'
import { toast, updateViewingArticle } from '~/signal'

import { ICON } from '../constant'

import CheckSVG from '~/icons/CheckBold'

import S from '../schema'
import useTouched from '../useTouched'
import Footer from './Footer'
import useSalon, { cn } from '../styles/sub_menu/cat_setting'

type TProps = {
  onBack: () => void
}

const CatSetting: FC<TProps> = ({ onBack }) => {
  const s = useSalon()

  const { article } = useViewingArticle()
  const [cat, setCat] = useState(article.cat)

  const { touched, setTouched, resetTouched } = useTouched()
  const [result, setPostCat] = useMutation(S.setPostCat)

  useEffect(() => {
    setCat(article.cat)
  }, [])

  const handleCat = () => {
    const params = { id: article.id, cat }
    setPostCat(params).then((result) => {
      if (result.error) {
        toast('修改失败', 'error')
      } else {
        toast('修改完成')
        const newCat = result.data.setPostCat.cat
        setCat(newCat)
        updateViewingArticle({ id: article.id, cat: newCat })
        resetTouched()
      }
    })
  }

  return (
    <div className={s.wrapper}>
      {POST_CAT_MENU_ITEMS.map((item) => {
        const TheIcon = ICON[item.key]
        const $active = item.key === cat

        return (
          <div
            key={item.key}
            className={cn(s.item, $active && s.itemActive)}
            onClick={() => {
              setCat(item.key)
              setTouched(item.key !== article.cat)
            }}
          >
            <TheIcon className={s.icon} />
            <div className={cn(s.title, $active && s.titleActive)}>{Trans(item.key)}</div>
            {$active && <CheckSVG className={s.checkIcon} />}
          </div>
        )
      })}

      <Footer
        onBack={onBack}
        loading={result.fetching}
        disabled={!touched}
        onConfirm={() => handleCat()}
        top={4}
      />
    </div>
  )
}

export default CatSetting
