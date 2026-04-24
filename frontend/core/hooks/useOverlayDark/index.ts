import useDashboard from '~/stores/dashboard/hooks'

export default function useOverlayDark(): boolean {
  const { overlayDark } = useDashboard()

  return overlayDark
}
