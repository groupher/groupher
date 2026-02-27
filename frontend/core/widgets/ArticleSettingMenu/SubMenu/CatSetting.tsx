import { type FC, useState } from 'react'
import { useMutation } from 'urql'
import { POST_CAT_MENU_ITEMS } from '~/const/menu'
import useTrans from '~/hooks/useTrans'
import useViewingArticle from '~/hooks/useViewingArticle'
import CheckSVG from '~/icons/CheckBold'
import { toast, updateViewingArticle } from '~/signal'
import { ICON } from '../constant'
import useSalon, { cn } from '../salon/sub_menu/cat_setting'
import S from '../schema'
import useTouched from '../useTouched'
import Footer from './Footer'

type TProps = {
  onBack: () => void
}

const CatSetting: FC<TProps> = ({ onBack }) => {
  const s = useSalon()
  const { t } = useTrans()

  const { article } = useViewingArticle()
  const [cat, setCat] = useState(article.cat)

  const { touched, setTouched, resetTouched } = useTouched()
  const [result, setPostCat] = useMutation(S.setPostCat)

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
          <button
            key={item.key}
            className={cn(s.item, $active && s.itemActive)}
            onClick={() => {
              setCat(item.key)
              setTouched(item.key !== article.cat)
            }}
          >
            <TheIcon className={s.icon} />
            <div className={cn(s.title, $active && s.titleActive)}>{t(item.key)}</div>
            {$active && <CheckSVG className={s.checkIcon} />}
          </button>
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
