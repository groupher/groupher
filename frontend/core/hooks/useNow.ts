import useDashboard from '~/hooks/useDashboard'

export default (): number => {
  const dashboard$ = useDashboard()

  return dashboard$.now
}
