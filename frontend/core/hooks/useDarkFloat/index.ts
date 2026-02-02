import useDashboard from '~/hooks/useDashboard'

export default (): boolean => {
  const { darkFloat } = useDashboard()

  return darkFloat
}
