export { cn } from '~/css'

export default function useSalon() {
  return {
    wrapper: 'sticky column min-h-0 pr-2 overflow-visible',
    groupList:
      'column min-h-0 flex-1 gap-y-4 -ml-7 w-[calc(100%+1.75rem)] overflow-y-auto overscroll-contain pl-7 pr-1 pb-14',
    empty: 'px-1 pt-2 text-xs text-digest',
  }
}
