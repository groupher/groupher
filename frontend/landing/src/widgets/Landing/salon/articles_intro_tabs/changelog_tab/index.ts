import useBase from '..'

export { cn } from '~/css'

export default function useSalon() {
  const base = useBase()

  return {
    wrapper: base.main,
    active: base.mainActive,
    divider: 'ml-5 mr-8',
  }
}
