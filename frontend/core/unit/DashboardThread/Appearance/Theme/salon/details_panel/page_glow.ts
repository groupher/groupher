import { cn } from '~/css'

export default function useSalon() {
  return {
    settingRow: 'row align-start gap-4 py-3',
    swatches: 'w-2/5 pl-1 row align-start justify-end',
    swatchRow: cn('w-full wrap justify-start gap-x-2 gap-y-2'),
  }
}
