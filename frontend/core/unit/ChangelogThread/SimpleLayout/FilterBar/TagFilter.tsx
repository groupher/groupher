import type { FC } from 'react'

import useSalon from './salon'

const TagFilter: FC = () => {
  const s = useSalon()

  return (
    <>
      <div className={s.item}>iOS</div>
      <div className={s.item}>编辑器</div>
      <div className={s.item}>性能</div>
    </>
  )
}

export default TagFilter
