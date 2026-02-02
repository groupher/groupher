import useDashboard from '~/hooks/useDashboard'

export default (): number => {
  const dsb$ = useDashboard()

  return dsb$.now
}
