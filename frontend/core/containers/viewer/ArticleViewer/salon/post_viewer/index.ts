import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, hover } = useTwBelt()

  return {
    bodyWrapper: 'min-h-52 mt-6 mb-3.5',
    title: 'ml-0.5 relative',
    titleText: cn('text-2xl  w-11/12', fg('title')),
    subTitle: cn(
      'absolute top-1 right-0',
      fg('hint'),
      'text-xl',
      'before:content-["#"] before:mt-[1px] before:mr-1 before:text-lg before:font-sans',
    ),
    gotoTop: cn(
      'row-center items-end fixed bottom-10 right-6 size-9 smoky-80 z-30',
      'trans-all-200',
      hover('bg'),
    ),
  }
}
