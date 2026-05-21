import useBase from '../../Table/salon'

export { cn } from '~/css'

export default function useSalon() {
  const base = useBase({ loading: false })

  return {
    title: base.title,
    icon: base.icon,
  }
}
