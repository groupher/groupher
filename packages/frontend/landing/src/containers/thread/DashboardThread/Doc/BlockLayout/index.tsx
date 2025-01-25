import type { FC } from 'react'

import Block from './Block'
import AdderBlock from './AdderBlock'

import type { TDocSettings } from '../../spec'
import useSalon from '../../salon/doc/block_layout'

type TProps = {
  settings: TDocSettings
}

const BlockList: FC<TProps> = ({ settings }) => {
  const s = useSalon()
  const { categories } = settings

  return (
    <div className={s.wrapper}>
      <div className={s.cats}>
        {categories.map((cat) => (
          <Block key={cat.index} color={cat.color} title={cat.name} />
        ))}
        <AdderBlock />
      </div>
    </div>
  )
}

export default BlockList
