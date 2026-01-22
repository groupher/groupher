import useBase from '..'

export { cn } from '~/css'

export default () => {
  const base = useBase()

  return {
    title: base.title,
    icon: base.icon,
    cell: base.cell,

    table: base.table,
  }
}
