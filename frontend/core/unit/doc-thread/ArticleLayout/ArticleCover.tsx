import useSalon from '../salon/article_layout/article_cover'

import Img from '~/Img'

const ArticleCover = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Img src="/help-cover-demo.png" noLazy className={s.image} />
    </div>
  )
}

export default ArticleCover
