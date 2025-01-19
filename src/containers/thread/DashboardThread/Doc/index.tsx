import type { FC } from 'react'

import type { TDocSettings } from '../spec'
import Header from './Header'
import BlockLayout from './BlockLayout'

import useSalon from '../salon/doc'

type TProps = {
  settings: TDocSettings
}

const Doc: FC<TProps> = ({ settings }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Header />
      <BlockLayout settings={settings} />
      {/* <FileTree /> */}
    </div>
  )
}

export default Doc
