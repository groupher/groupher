/*
 *
 * ArticleImgWindow
 *
 */

import type { FC } from 'react'

import useSalon from './salon'

type TProps = {
  testid?: string
}

const ArticleImgWindow: FC<TProps> = ({ testid = 'article-img-window' }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.block} />
      <div className={s.block} />
    </div>
  )
}

export default ArticleImgWindow
