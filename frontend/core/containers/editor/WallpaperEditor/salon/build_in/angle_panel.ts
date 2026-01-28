import { GRADIENT_DIRECTION } from '~/const/wallpaper'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

const metric = {
  [GRADIENT_DIRECTION.TOP]: {
    rotate: '90deg',
  },
  [GRADIENT_DIRECTION.TOP_LEFT]: {
    rotate: '40deg',
  },
  [GRADIENT_DIRECTION.TOP_RIGHT]: {
    rotate: '140deg',
  },
  [GRADIENT_DIRECTION.BOTTOM]: {
    rotate: '270deg',
  },
  [GRADIENT_DIRECTION.BOTTOM_LEFT]: {
    rotate: '315deg',
  },
  [GRADIENT_DIRECTION.BOTTOM_RIGHT]: {
    rotate: '225deg',
  },
  [GRADIENT_DIRECTION.LEFT]: {
    rotate: '0deg',
  },
  [GRADIENT_DIRECTION.RIGHT]: {
    rotate: '180deg',
  },
}

type TProps = {
  direction: string
}

export default ({ direction }: TProps) => {
  const { cn, br, bg, fill, primary } = useTwBelt()

  return {
    wrapper: cn('group size-[68px] circle border relative mt-6', br('divider')),
    needleDot: cn('size-1.5 circle absolute left-7 top-7 ml-px', bg('dot')),
    needle: cn('absolute w-8 h-px top-7 left-0 mt-0.5 origin-right', bg('dot')),
    needleStyle: { transform: `rotate(${metric[direction].rotate}) ` },
    //
    point: cn(
      'align-both absolute size-4 circle z-20 pointer border border-transparent',
      bg('divider'),
      `hover:${br('digest')}`,
    ),
    pointActive: cn(primary('bg')),
    top: '-top-2 left-6 pb-px',
    bottom: '-bottom-2 left-6 pt-px',
    left: '-left-2 top-6 pr-px',
    right: '-right-2 top-6 pl-px',

    //
    sidePoint: 'size-3 group-smoky-65',
    topLeft: 'top-1 left-0.5 pb-px pr-px',
    topRight: 'top-1 left-14 pb-px -ml-0.5',
    bottomLeft: 'bottom-1.5 left-0.5 pr-px',
    bottomRight: 'bottom-1.5 left-14 pt-px -ml-0.5',

    //
    arrowIcon: cn('size-3.5', fill('digest')),
    arrowActive: cn(fill('button.fg')),
  }
}
