import useDashboard from '~/stores/dashboard/hooks'

/** Exposes overlay dark state and actions through the shared React hook boundary. */
export default function useOverlayDark(): boolean {
  const { overlayDark } = useDashboard()

  return overlayDark
}
