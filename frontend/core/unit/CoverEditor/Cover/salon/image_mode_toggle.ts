import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { bg, fg, primary } = useTwBelt()

  return {
    wrapper:
      'absolute left-1/2 top-2 z-50 flex -translate-x-1/2 rounded border p-px opacity-0 shadow-sm transition-opacity duration-150 group-hover/image-editor:opacity-100',
    wrapperActive: 'opacity-100',
    button:
      'flex size-5 items-center justify-center rounded-sm transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-current',
    buttonActive: [primary('bg'), 'text-white'].join(' '),
    buttonIdle: [fg('text.digest'), 'hover:bg-hoverBg'].join(' '),
    buttonRepositionIdle: primary('fg'),
    icon: 'size-3.5',
    shell: [bg('alphaBg'), primary('border')].join(' '),
    tooltipText: 'block px-0.5 py-px text-xs leading-none',
  }
}
