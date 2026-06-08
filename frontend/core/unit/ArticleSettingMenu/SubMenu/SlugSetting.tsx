import type { FC } from 'react'

import useViewingArticle from '~/hooks/useViewingArticle'
import Input from '~/widgets/Input'

import Footer from './Footer'
import useSalon from './salon/slug_setting'

type TProps = {
  onBack: () => void
}

const SlugSetting: FC<TProps> = ({ onBack }) => {
  const s = useSalon()

  const { articleLink } = useViewingArticle()

  return (
    <div className={s.wrapper}>
      <Input focusOnMount className={s.input} />
      <div className={s.note}>链接预览: </div>
      <div className={s.preview}>
        {articleLink}
        <span className={s.slug}>/whats-new</span>
      </div>

      <Footer onBack={onBack} onConfirm={() => console.log('## ## title confirm')} top={8} />
    </div>
  )
}

export default SlugSetting
