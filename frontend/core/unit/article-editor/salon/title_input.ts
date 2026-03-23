import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'column items-center w-full',
    input: cn('w-10/12 block border-none', fg('title')),
    inputer: cn(
      'w-full block rounded-none border-none bg-transparent',
      'pl-3 pb-1 h-14 text-2xl leading-normal',
      'hover:border-none focus:border-none focus:shadow-none',
      fg('title'),
      '[&::placeholder]:text-2xl [&::placeholder]:opacity-60',
      `[&::placeholder]:${fg('title')}`,
    ),
  }
}
