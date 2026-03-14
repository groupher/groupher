import useBase from '..'

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
