import useDashboard from '~/stores/dashboard/hooks'

export default function useDarkFloat(): boolean {
  const { darkFloat } = useDashboard()

  return darkFloat
}
