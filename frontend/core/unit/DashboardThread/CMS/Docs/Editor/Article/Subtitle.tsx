import type { ChangeEvent, FC } from 'react'

import useSalon from './salon/subtitle'

type TProps = {
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}

const Subtitle: FC<TProps> = ({ value, disabled = false, onChange }) => {
  const s = useSalon()

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value)
  }

  return (
    <input
      className={s.wrapper}
      value={value}
      disabled={disabled}
      placeholder='Page description (optional)'
      onChange={handleChange}
    />
  )
}

export default Subtitle
