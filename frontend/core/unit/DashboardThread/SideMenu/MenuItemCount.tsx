import useSalon from './salon/menu_item_count'

type TProps = {
  value: number
}

export default function MenuItemCount({ value }: TProps) {
  const s = useSalon()

  return <span className={s.count}>{value}</span>
}
