import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, bg, fg, rainbow, margin, shadow } = useTwBelt()

  return {
    wrapper: cn('row-center relative px-5 h-28 rounded-md overflow-hidden', margin(spacing)),
    bgWrapper: cn('absolute  h-full w-1/3', 'mix-blend-color-burn', 'scale-80 opacity-20'),
    bgStyle: {
      backgroundImage: 'url(/pattern/ab-p2.png)',
      transform: 'rotate(215deg)',
      right: '22%',
      top: '-50px',
    },

    bgWrapper2: cn('absolute h-full w-1/3', 'mix-blend-color-burn', 'opacity-10'),
    bgStyle2: {
      backgroundImage: 'url(/pattern/ab-p1.png)',
      transform: 'rotate(168deg)',
      right: '20%',
      bottom: '-60px',
    },

    content: 'w-2/3',
    title: cn('text-base relative z-2 bold-sm', fg('title')),
    desc: cn('text-xs mt-2.5 line-clamp-2', fg('digest')),
    linkButton: cn(
      'rounded-md text-sm py-1.5 px-4 scale-90',
      bg('alphaBg'),
      'hover:bg-alphaBg2',
      'shadow-lg',
      shadow('xl'),
    ),
    notifyIcon: cn('size-8 absolute top-1 -mt-0.5 mr-1.5', '-scale-x-100 mix-blend-color-burn'),
    notifyStyle: { left: '130px', rotate: '20deg' },
    linkBtn: cn('px-4 py-1.5 pr-0 rounded-lg w-20', bg('alphaBg')),
    rainbow,
  }
}
