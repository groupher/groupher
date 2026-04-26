import type { FC } from 'react'

import type { TInput } from '~/spec'
import Input from '~/widgets/Input'

import useSalon from '../salon/banner/input_box'

type TProps = {
  placeholder?: string
  value?: string
  onChange: (e: TInput) => void
  onBlur?: () => void
}

const InputBox: FC<TProps> = ({ placeholder = '', value = '', onChange, onBlur = console.log }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Input
        className={s.input}
        onChange={(e) => onChange(e)}
        value={value}
        placeholder={placeholder}
        onBlur={onBlur}
        autoFocus
      />
    </div>
  )
}

export default InputBox
