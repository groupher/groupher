import type { ChangeEvent, FC } from 'react'

import Input from '~/widgets/Input'

import { needsPublishAttention } from '../../SideTree/helper'
import type { TDocTreeNodePublishState } from '../../SideTree/spec'
import useSalon from './salon'
import Stage from './Stage'

type TProps = {
  value: string
  disabled?: boolean
  publishState?: TDocTreeNodePublishState | null
  onChange: (value: string) => void
}

const Title: FC<TProps> = ({ value, disabled = false, publishState, onChange }) => {
  const s = useSalon()
  const draft = needsPublishAttention(publishState)

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value)
  }

  return (
    <div className={s.wrapper}>
      <Input
        behavior='textarea'
        fgColor='title'
        className={s.input}
        value={value}
        disabled={disabled}
        placeholder='Title'
        disableEnter
        onChange={handleChange}
      />
      {draft && <Stage />}
    </div>
  )
}

export default Title
