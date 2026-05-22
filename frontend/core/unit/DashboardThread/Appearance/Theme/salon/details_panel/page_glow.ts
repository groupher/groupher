import { cn } from '~/css'

export default function useSalon() {
  return {
    swatches: 'w-2/5 pl-1 row-center justify-end',
    swatchRow: cn('w-full wrap justify-start gap-x-2 gap-y-2'),
  }
}
