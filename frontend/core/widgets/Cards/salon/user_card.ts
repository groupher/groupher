import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, avatar } = useTwBelt()

  return {
    wrapper: 'column w-52 min-h-24 px-2.5 py-1',
    avatar: cn('size-10', avatar()),
    shortBio: cn('text-xs mt-0.5', fg('digest')),
    info: 'column ml-3',
    header: 'row-center mb-2.5',
    title: 'text-base no-underline bold-sm hover:underline',
    //
    nickname: cn('text-sm', fg('title')),
    login: cn('text-xs', fg('digest')),
    desc: cn('text-sm', fg('digest')),
  }
}
