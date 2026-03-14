import useDashboard from '~/hooks/useDashboard'

export default function useDarkFloat(): boolean {
  const { darkFloat } = useDashboard()

  return darkFloat
}
