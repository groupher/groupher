import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, dimDark } = useTwBelt()

  return {
    wrapper: cn('column h-full w-[1000px] py-16'),
    lightBlob:
      'absolute inset-x-0 h-px top-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-40 w-[400px] left-[360px]',
    lightGlow: 'absolute -top-12 -left-5 keyboard-glow',
    banner: 'w-auto ml-24 z-40',
    bottom: 'w-auto ml-24 z-40 mt-4 -ml-2',
    detail: cn('text-sm', fg('text.digest')),
    title: cn(fg('text.title'), 'text-2xl bold-sm'),
    desc: cn(fg('text.digest'), 'text-base mt-2'),
    techs: cn('row wrap w-full h-auto items-start gap-x-2 gap-y-2 z-20 mt-6 mb-6', dimDark()),
    topping: cn('row-center mb-1.5 w-28'),
  }
}
