import useBase from '..'

export { cn } from '~/css'

export default function useSalon() {
  const base = useBase({ loading: false })

  return {
    title: base.title,
    icon: base.icon,
  }
}
