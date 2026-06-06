import type { FC } from 'react'

import useSalon from './salon/title'

const Title: FC = () => {
  const s = useSalon()

  return <h1 className={s.wrapper}>Title</h1>
}

export default Title
