import type { FC } from 'react'

import useViewingArticle from '~/hooks/useViewingArticle'

import Footer from './Footer'
import { Wrapper, Inputer, Note, Preview, Slug } from '../styles/sub_menu/slug_setting'

type TProps = {
  onBack: () => void
}

const SlugSetting: FC<TProps> = ({ onBack }) => {
  const { articleLink } = useViewingArticle()

  return (
    <Wrapper>
      <Inputer autoFocus />
      <Note>链接预览: </Note>
      <Preview>
        {articleLink}
        <Slug>/whats-new</Slug>
      </Preview>

      <Footer
        onBack={onBack}
        onConfirm={() => console.log('## ## title confirm')}
        top={8}
        bottom={2}
      />
    </Wrapper>
  )
}

export default SlugSetting
