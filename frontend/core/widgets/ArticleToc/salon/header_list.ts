import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill, primary } = useTwBelt()

  return {
    wrapper:
      'absolute right-0 top-0 -mt-10 w-max max-w-36 pt-10 origin-top-right pointer-events-auto',
    inner: 'pb-1.5',
    pinButton:
      'button-reset row-center justify-end absolute top-0 right-0 z-10 size-10 pointer smoky-60 transition-transform duration-150 ease-out active:scale-95',
    pinButtonPinned: primary('fill'),
    pinButtonIdle: cn(fill('digest'), `hover:${fill('title')}`),
    pinIcon: 'size-3.5',
    item: 'button-reset row-center justify-start w-full max-w-full h-7 text-sm text-left pointer trans-all-200',
    flush: 'pl-0',
    indent: 'pl-4',
    active: cn(primary('fg'), 'bold-sm'),
    idle: cn(fg('digest'), `hover:${fg('title')}`),
    title: 'block max-w-full truncate min-w-0 text-left',
  }
}
