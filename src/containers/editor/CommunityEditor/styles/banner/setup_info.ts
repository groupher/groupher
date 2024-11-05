import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, fill } = useTwBelt()

  return {
    wrapper: cn('column-align-both relative w-full h-72', fg('text.digest')),
    head: 'row-center mb-6 gap-x-1.5',
    applyIcon: cn('size-5 opacity-80', fill('text.digest')),
    introTitle: cn('text-xl', fg('text.title')),
    //
    info: 'row-center mb-8',
    nextBtns: 'align-both w-48 ml-3',
    //
    realCover: 'size-20 rounded-md',
    holderWrapper: cn('column-align-both size-20 rounded-md', bg('hoverBg')),
    uploadIcon: cn('size-6 opacity-50 mb-1', fill('text.digest')),
    uploadText: cn('text-sm bold-sm italic opacity-50', fill('text.digest')),
    //
    inputs: 'ml-4',
    input: 'w-72 h-9 rounded-md placeholder:text-sm',
  }
}
