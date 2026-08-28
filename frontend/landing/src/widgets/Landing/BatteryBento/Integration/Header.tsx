import useSalon, { cn } from '../../salon/battery_bento/integration/header'

export default function Header() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={cn(s.dot, 'left-4')} />
      <div className={cn(s.dot, 'left-7')} />
      <div className={cn(s.dot, 'left-10')} />

      <div className={cn(s.bar, 'left-24')} />
      <div className={cn(s.bar, 'right-5 w-5 opacity-15')} />
    </div>
  )
}
