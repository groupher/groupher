import useTwBelt from '~/hooks/useTwBelt'

import useBase from '.'

export { cn } from '~/css'

export default () => {
  const { cn, fg, br, shadow } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn('column'),
    content: 'row align-start mt-10 mb-8',
    previewer: 'column-center relative',
    previewImage: cn('column-align-both w-72 h-60 rounded-md border', br('divider')),
    //
    contentBlock: cn(
      'absolute -top-5 left-4 w-64 h-60 border',
      'z-20 p-5 rounded-md trans-all-200',
      br('divider'),
      shadow('xl'),
    ),
    //
    actions: 'w-1/2 h-full grow ml-12 list-disc',
    title: cn('text-sm mb-2.5', fg('text.title')),
    desc: cn('text-sm mb-1.5 ml-5', fg('text.digest')),
    highlight: cn('ml-px mr-px bold-sm', fg('text.title')),
    //
    bar: cn(base.bar, 'h-2 w-24 saturate-50 opacity-40'),
  }
}
