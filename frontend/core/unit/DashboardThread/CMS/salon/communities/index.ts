import useBase from '../../Table/salon'

export { cn } from '~/css'

export default function useSalon({ loading }) {
  const base = useBase({ loading })

  return {
    title: base.title,
    icon: base.icon,
    cell: base.cell,

    table: base.table,
  }
}
