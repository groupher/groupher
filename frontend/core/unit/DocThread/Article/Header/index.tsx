import type { FC } from 'react'

import type { TDocPublicTree } from '~/spec'
import useArticle from '~/stores/article/hooks'

import useSalon from './salon'
import Topping from './Topping'

type TProps = {
  tree: TDocPublicTree
}

const Header: FC<TProps> = ({ tree }) => {
  const { doc } = useArticle()
  const s = useSalon()

  if (!doc) return <h1 className={s.error}>Doc not found</h1>

  return (
    <header className={s.wrapper}>
      <Topping doc={doc} tree={tree} />

      <h1 className={s.title}>{doc.title || 'Untitled'}</h1>
      {!!doc.subtitle && <p className={s.subtitle}>{doc.subtitle}</p>}
    </header>
  )
}

export default Header
