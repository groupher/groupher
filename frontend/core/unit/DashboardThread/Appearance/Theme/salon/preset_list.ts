export { cn } from '~/css'

export const ROTATE_ANGLES = [6, 3, 2, 6, 12, 2, 3, 6, 12, 3, -2, 6] as const

export default function useSalon() {
  return {
    presetList: 'row-center mt-2 ml-4 wrap gap-y-6',
  }
}
