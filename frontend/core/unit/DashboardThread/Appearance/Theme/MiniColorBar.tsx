type TProps = {
  className?: string
  color: string
}

export default function MiniColorBar({ color, className }: TProps) {
  return <span className={className} style={{ backgroundColor: color }} />
}
