'use client'

import { type FC } from 'react'

import useSalon from '../salon'

const EmojiTab: FC = () => {
  const s = useSalon()

  return (
    <div className={s.todo}>
      <h2>TODO</h2>
    </div>
  )
}

export default EmojiTab
