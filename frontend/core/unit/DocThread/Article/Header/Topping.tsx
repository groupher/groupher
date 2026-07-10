import type { FC } from 'react'

import type { TDoc, TDocPublicTree } from '~/spec'

import Copy from './Copy'
import Group from './Group'
import useSalon from './salon/topping'
import Share from './Share'

type TProps = {
  doc: TDoc
  tree: TDocPublicTree
}

const Topping: FC<TProps> = ({ doc, tree }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Group doc={doc} tree={tree} />
      <div className='grow' />
      <div className={s.actions}>
        <Copy />
        <Share />
      </div>
    </div>
  )
}

export default Topping
