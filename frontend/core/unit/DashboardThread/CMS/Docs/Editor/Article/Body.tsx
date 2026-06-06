import type { FC } from 'react'

import useSalon from './salon/body'

const Body: FC = () => {
  const s = useSalon()

  return <h1 className={s.wrapper}>Body</h1>
}

export default Body
