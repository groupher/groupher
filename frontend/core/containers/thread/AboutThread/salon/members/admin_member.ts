import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'row items-start mb-4',
    info: '',
    name: cn('truncate w-28 text-base mb-0.5 font-medium', fg('title')),
    bio: cn('text-xs w-4/5 line-clamp-2', fg('hint')),
  }
}
