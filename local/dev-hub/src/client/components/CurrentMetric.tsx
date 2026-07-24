type TProps = {
  label: string
  value: string
  critical?: boolean
}

export function CurrentMetric({ label, value, critical = false }: TProps) {
  return (
    <span>
      <small>{label}</small>
      <strong className={critical ? 'is-critical' : ''}>{value}</strong>
    </span>
  )
}
