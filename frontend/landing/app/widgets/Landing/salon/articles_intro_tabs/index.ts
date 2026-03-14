export { cn } from '~/css'

export default function useSalon() {
  return {
    wrapper: 'column-align-both w-full mt-32',
    main: 'align-both w-full relative overflow-hidden h-0',
    mainActive: 'h-full',
    featList: 'column gap-y-4 mt-12',

    footer: 'row-center mt-10 row gap-x-2',
  }
}
