export default function useSalon() {
  return {
    wrapper: 'column items-end self-end text-right',
    value: 'text-title text-2xl tabular-nums leading-8',
    status: 'row-center mt-2.5 gap-x-2 text-digest text-sm leading-5',
    dot: 'relative flex size-2',
    dotPing:
      'absolute inline-flex size-full motion-safe:animate-ping animate-duration-2000 rounded-full bg-green-500 opacity-75',
    dotCore: 'relative inline-flex size-2 rounded-full bg-green-500',
    stale: 'mt-2.5 text-digest text-xs leading-5',
  }
}
