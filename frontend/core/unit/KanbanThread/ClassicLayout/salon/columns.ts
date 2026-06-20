import useKanbanBgColors from '~/hooks/useKanbanBgColors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon(columnsCount = 5) {
  const [backlogBg, todoBg, wipBg, doneBg, rejectedBg] = useKanbanBgColors()
  const { cn, fg, rainbow } = useTwBelt()
  const isCompactBoard = columnsCount <= 3

  const body = 'p-2 pb-0 rounded-xl w-full'

  return {
    scroller: cn(
      'w-full overflow-y-visible [scrollbar-gutter:stable] scroll-smooth',
      isCompactBoard ? 'overflow-x-hidden' : 'overflow-x-auto',
    ),
    headerRowViewport: 'w-full overflow-hidden',
    columnsTrack: cn('flex items-start gap-5', isCompactBoard ? 'w-full min-w-0' : 'min-w-max'),
    columnBase: 'column min-h-96',
    scrollColumn: isCompactBoard ? 'grow basis-0 min-w-0' : 'shrink-0 w-64',
    header: 'row-center py-1.5 w-full pl-0.5',
    label: cn('text-base bold ml-2.5', fg('digest')),
    subTitle: cn('text-sm ml-1.5', fg('hint')),
    //
    backlogIcon: cn('size-3', rainbow(backlogBg, 'fill')),
    todoIcon: cn('size-3', rainbow(todoBg, 'fill')),
    wipIcon: cn('size-3.5', rainbow(wipBg, 'fill')),
    doneIcon: cn('size-3', rainbow(doneBg, 'fill')),
    rejectedIcon: cn('size-3', rainbow(rejectedBg, 'fill')),
    //
    backlogBody: cn(body, rainbow(backlogBg, 'bgSoft')),
    todoBody: cn(body, rainbow(todoBg, 'bgSoft')),
    wipBody: cn(body, rainbow(wipBg, 'bgSoft')),
    doneBody: cn(body, rainbow(doneBg, 'bgSoft')),
    rejectedBody: cn(body, rainbow(rejectedBg, 'bgSoft')),
  }
}
