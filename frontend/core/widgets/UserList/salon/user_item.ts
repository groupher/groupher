import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, avatar, fg } = useTwBelt()

  return {
    wrapper: cn('row items-start w-full', 'last:mb-12'),
    avatar: cn('size-8 mt-2', avatar()),
    main: 'column ml-3',
    header: 'row-center',
    title: cn('text-base bold-sm', fg('title')),
    login: cn(fg('hint'), 'text-sm ml-1.5', 'before:content-["@"] before:text-xs before:mr-px'),
    bio: cn('text-xs', fg('digest')),
  }
}
