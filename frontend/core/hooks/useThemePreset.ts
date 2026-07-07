import useThemePresetStore from '~/stores/ThemePreset/hooks'

/**
 * Public hook alias for the ThemePreset store.
 *
 * Keeping this hook in `~/hooks` gives feature components a stable import path
 * while the Valtio store implementation stays under `~/stores/ThemePreset`.
 */
export default function useThemePreset() {
  return useThemePresetStore()
}
