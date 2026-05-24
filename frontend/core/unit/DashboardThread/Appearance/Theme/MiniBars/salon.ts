import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TArgs = {
  active?: boolean
}

export default function useSalon({ active = false }: TArgs = {}) {
  const { cn } = useTwBelt()

  return {
    bars: cn('row-center absolute bottom-2 left-2 gap-1', active ? 'opacity-80' : 'opacity-50'),
    primaryBar: 'h-2.5 w-6 rounded',
    subBar: 'h-2.5 w-4 rounded',
    textBar: 'border-divider size-3 circle border shadow-xs',
  }
}
