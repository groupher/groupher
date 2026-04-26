import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, fill, br, shadow, rainbow } = useTwBelt()

  return {
    wrapper: 'row w-full h-44 px-4 py-4 mt-20',
    ogPanel: 'w-1/2 pl-2.5 relative',
    twPanel: 'w-1/2 pl-14 relative',
    logo: 'size-9 rounded mb-4 mt-2 gradient-orange',

    title: cn('text-xs mb-1.5 mt-2.5', fg('title')),
    desc: cn('text-xs', fg('digest')),
    //
    linkDesc: cn('text-xs mt-1.5', fg('digest')),
    iconBox: 'absolute left-2.5',
    icon: cn('size-3.5 mr-1 opacity-65', fill('digest')),
    //
    bar: cn('w-10 h-1.5 opacity-15 rounded-md absolute', bg('digest')),
    editBox: cn(
      'align-both size-9 rounded-2xl border absolute top-48 left-48',
      br('divider'),
      shadow('sm'),
      'gradient-orange',
    ),
    editIcon: cn('size-4 opacity-65', rainbow(COLOR.BROWN, 'fill')),
  }
}
