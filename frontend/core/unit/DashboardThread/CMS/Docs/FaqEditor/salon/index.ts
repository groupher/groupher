import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, primary } = useTwBelt()

  return {
    wrapper: 'mx-auto w-1/2 mt-8 pr-4',
    titleText: cn('text-2xl font-bold', fg('title')),
    descText: cn('text-sm', fg('digest')),
    descBlock: 'mt-2',
    toolbar: 'row-center mt-4 mb-8 justify-between',
    addIcon: cn('mr-1.5 size-3', primary('fill')),
    modeSavingBar: '-mt-4 mb-8',
    groups: 'column gap-y-8',
    listSavingBar: 'mt-6',
  }
}
