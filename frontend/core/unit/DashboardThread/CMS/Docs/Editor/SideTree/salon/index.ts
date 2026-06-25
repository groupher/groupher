export { cn } from '~/css'

export default function useSalon() {
  return {
    wrapper: 'sticky column min-h-0 pr-2 overflow-hidden',
    groupList: 'column min-h-0 flex-1 gap-y-4 overflow-y-auto overscroll-contain pr-1 pb-4',
  }
}
