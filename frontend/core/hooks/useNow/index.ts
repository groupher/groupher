import useDashboard from '~/stores/dashboard/hooks'

export default function useNow(): number {
  const dsb$ = useDashboard()

  return dsb$.now
}
