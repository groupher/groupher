import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = { offsetRight: number; withLastUpdated: boolean }

export default function useSalon({ offsetRight, withLastUpdated }: TProps) {
  const { cn, br, fg, hover } = useTwBelt()

  return {
    wrapper: cn(
      'w-full pt-12 border-t',
      withLastUpdated ? 'row-between' : 'column-align-both',
      withLastUpdated ? 'pr-0' : `pr-${offsetRight}`,
      br('divider'),
    ),
    lastUpdate: cn('text-xs opacity-80 ml-0.5', fg('digest')),
    feedback: withLastUpdated ? 'row-center' : 'column-align-both',
    //
    title: cn('text-sm mb-4', fg('title')),
    titleSmall: cn('text-xs mr-3 mt-px opacity-80', fg('digest')),
    //
    faces: 'row-center gap-x-6',
    facesSmall: 'gap-x-1.5 mr-0.5',
    //
    iconBox: cn('size-8 align-both grayscale', hover('bg'), 'hover:grayscale-0'),
    iconBoxActive: 'scale-110 grayscale-0',

    icon: 'size-6',
    iconSmall: 'size-5',
  }
}
