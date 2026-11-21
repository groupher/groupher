import useDsb from '~/stores/dsb/hooks'

/** Exposes overlay dark state and actions through the shared React hook boundary. */
export default function useOverlayDark(): boolean {
  return useDsb().overlayDark
}
