import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { bg, selectable, cnMerge } = useTwBelt()

  return {
    section: 'column gap-3 w-full',
    pictureGrid: 'grid grid-cols-6 gap-2.5',
    button: (active: boolean) =>
      cnMerge(
        `relative p-1 shrink-0 rounded-md trans-all-200 text-left h-16 w-24 ${bg('card')}`,
        selectable('box', { active }),
      ),
    pictureContent: 'relative row-center s-full overflow-hidden rounded-md',
    pictureImage: 'object-cover s-full rounded-xs',
    activeSign: cnMerge(selectable('badge', { size: 'sm' }), '-top-1.5 -right-2.5'),
    checkIcon: selectable('check', { size: 'sm' }),
  }
}
