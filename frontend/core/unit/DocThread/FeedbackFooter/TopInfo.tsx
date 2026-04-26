import type { FC } from 'react'

import ArrowButton from '~/widgets/Buttons/ArrowButton'

import useSalon from './salon/top_info'

const TopInfo: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <ArrowButton leftLayout>编辑器</ArrowButton>
      <ArrowButton>三方集成</ArrowButton>
    </div>
  )
}

export default TopInfo
