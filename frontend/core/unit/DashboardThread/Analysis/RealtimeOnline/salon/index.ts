export default function useSalon() {
  return {
    wrapper: 'column items-end self-end text-right',
    value: 'text-title text-2xl tabular-nums leading-none',
    status: 'row-center gap-x-2 text-digest text-xs leading-none',
    dot: 'relative flex size-2',
    dotPing:
      'absolute inline-flex size-full motion-safe:animate-ping rounded-full bg-green-500 opacity-75',
    dotCore: 'relative inline-flex size-2 rounded-full bg-green-500',
    stale: 'text-digest text-xs',
  }
}
