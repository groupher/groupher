import type { FC } from 'react'
import type { ChangeEvent } from 'react'

import useSalon from './salon/title'

type TProps = {
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}

const Title: FC<TProps> = ({ value, disabled = false, onChange }) => {
  const s = useSalon()

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value)
  }

  return (
    <input
      className={s.wrapper}
      value={value}
      disabled={disabled}
      placeholder='Title'
      onChange={handleChange}
    />
  )
}

export default Title
