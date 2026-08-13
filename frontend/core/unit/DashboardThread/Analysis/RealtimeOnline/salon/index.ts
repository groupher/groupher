export default function useSalon() {
  return {
    wrapper: 'column h-full items-end justify-between self-end text-right',
    value: 'text-title text-2xl tabular-nums leading-8',
    status: 'row-center gap-x-2 text-digest text-xs leading-5',
    dot: 'relative flex size-2',
    dotPing:
      'absolute inline-flex size-full motion-safe:animate-ping rounded-full bg-green-500 opacity-75',
    dotCore: 'relative inline-flex size-2 rounded-full bg-green-500',
    stale: 'text-digest text-xs',
  }
}
