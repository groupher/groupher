import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, hover, fg, avatar } = useTwBelt()

  return {
    wrapper: 'row items-start justify-between w-full relative mt-12',
    leftPart: 'grow max-w-[600px]',
    topping: 'align-both -ml-0.5 mb-4 pr-1 relative',
    backBtn: cn('align-both px-2 py-0.5 rounded-xl', hover('bg')),
    backText: hover('fg'),
    backIcon: cn('size-3 mr-1.5', hover('icon')),
    //
    title: cn('text-2xl mb-4 bold-sm max-w-[600px]', fg('title')),
    subTitle: cn(
      'inline-block text-lg ml-2.5 -mt-0.5 opacity-50',
      fg('digest'),
      'before:content-["#"] before:mr-0.5 before:text-base before:mt-px',
    ),
    bottomInfo: 'row-between pb-8 w-full',
    avatar: cn('size-4 mr-2', avatar()),
    authorName: cn(
      'row-center',
      'text-sm mt-px',
      'no-underline',
      'hover:underline hover:cursor-pointer',
      fg('digest'),
    ),
  }
}
