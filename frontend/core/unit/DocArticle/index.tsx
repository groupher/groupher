'use client'

import Content from './Content'
import Header from './Header'
import useSalon from './salon'

export default function DocArticle() {
  const s = useSalon()

  return (
    <article className={s.wrapper}>
      <Header />
      <Content />
    </article>
  )
}
