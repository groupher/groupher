import useTrans from '~/hooks/useTrans'
import type { TPaginationMode, TTransKey } from '~/spec'

import useSalon from './salon/settings'

const MODES = ['PAGE', 'LOAD_MORE', 'INFINITE_SCROLL'] as const

type TProps = {
  name: string
  title: string
  mode: TPaginationMode
  disabled: boolean
  onChange: (mode: TPaginationMode) => void
}

/** One independently named, keyboard-accessible preference group. */
export default function ModeOptions({ name, title, mode, disabled, onChange }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  return (
    <fieldset className={s.options} disabled={disabled}>
      <legend className={s.title}>{title}</legend>
      {MODES.map((value) => (
        <label key={value} className={s.option}>
          <input
            type='radio'
            name={name}
            value={value}
            checked={mode === value}
            onChange={() => onChange(value)}
          />
          {t(`dsb.pagi.${value.toLowerCase()}` as TTransKey)}
        </label>
      ))}
    </fieldset>
  )
}
