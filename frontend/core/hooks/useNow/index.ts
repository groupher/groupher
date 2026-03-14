import useDashboard from '~/hooks/useDashboard'

export default function useNow(): number {
  const dsb$ = useDashboard()

  return dsb$.now
}
