import useSalon from './salon/item'

type TProps = {
  completed: boolean
  current: boolean
  label: string
  number: number
  reached: boolean
  showLine: boolean
}

/** Renders one accessible phase marker in the Docs import stepper. */
export default function Item({ completed, current, label, number, reached, showLine }: TProps) {
  const s = useSalon({ completed, reached })

  return (
    <li className={s.wrapper} aria-current={current ? 'step' : undefined}>
      <span className={s.number}>{number}</span>
      <span className={s.label}>{label}</span>
      {showLine && <span className={s.line} />}
    </li>
  )
}
