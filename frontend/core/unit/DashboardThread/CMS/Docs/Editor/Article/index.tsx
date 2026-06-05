import type { FC } from 'react'

import Body from './Body'
import Cover from './Cover'
import Footer from './Footer'
import useSalon from './salon'
import Title from './Title'

const Article: FC = () => {
  const s = useSalon()

  return (
    <article className={s.wrapper}>
      <Cover />
      <Title />
      <Body />
      <Footer />
    </article>
  )
}

export default Article
