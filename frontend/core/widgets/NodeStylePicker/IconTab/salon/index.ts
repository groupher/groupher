import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { bg, cn, hover, primary } = useTwBelt()

  return {
    viewport: 'min-w-0 h-full overflow-x-hidden overflow-y-scroll overscroll-contain',
    gridRow: 'grid px-1',
    cell: cn(
      'align-both group flex h-10 min-w-0 rounded border border-transparent p-0.5 appearance-none transition-all duration-150',
      hover('box'),
    ),
    cellActive: primary('border'),
    iconColor: bg('digest'),
  }
}
