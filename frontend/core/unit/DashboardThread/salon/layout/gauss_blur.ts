import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cn, cnMerge, fg, br, shadow } = useTwBelt()
  const base = useBase()

  return {
    wrapper: 'column',
    content: 'row align-start mt-10 mb-8',
    previewer: 'column-center relative',
    previewImage: cn('column-align-both w-72 h-60 rounded-md border', br('divider')),
    //
    contentBlock: cn(
      'absolute -top-5 left-4 w-64 h-60 border',
      'z-20 column-start p-5 rounded-md trans-all-200',
      br('divider'),
      shadow('xl'),
    ),
    contentTop: 'column gap-3',
    contentBottom: 'column gap-3 mt-auto',
    //
    actions: 'w-1/2 h-full grow ml-12 list-disc',
    title: cn('text-sm mb-2.5', fg('title')),
    desc: cn('text-sm mb-1.5 ml-5', fg('digest')),
    highlight: cn('ml-px mr-px bold-sm', fg('title')),
    //
    bar: cnMerge(base.bar, 'static h-2 w-24 saturate-50 opacity-30'),
    titleBar: 'opacity-30',
    wideBar: 'w-40 opacity-20',
    midBar: 'w-28',
    longBar: 'w-44 opacity-20',
    shortBar: 'w-16 opacity-30',
    dimBar: 'w-32 opacity-15',
    footerMid: 'w-28 opacity-30',
    footerLong: 'w-44 opacity-15',
    footerBottomMid: 'w-28 opacity-20',
    footerBottomLong: 'w-44 opacity-10',
  }
}
