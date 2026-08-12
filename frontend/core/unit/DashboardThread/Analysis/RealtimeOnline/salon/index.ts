export default function useSalon() {
  return {
    wrapper: 'column items-end',
    value: 'text-title text-2xl tabular-nums',
    status: 'row-center gap-x-1 text-digest text-xs',
    dot: 'relative flex size-2.5',
    dotPing:
      'absolute inline-flex size-full motion-safe:animate-ping rounded-full bg-green-500 opacity-75',
    dotCore: 'relative inline-flex size-2.5 rounded-full bg-green-500',
    stale: 'text-digest text-xs',
  }
}
