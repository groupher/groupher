import useKanbanBgColors from '~/hooks/useKanbanBgColors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const [backlogBg, todoBg, wipBg, doneBg, rejectedBg] = useKanbanBgColors()
  const { cn, fg, rainbow } = useTwBelt()

  const body = 'p-2 pb-0 rounded-xl w-full'

  return {
    scroller: 'w-full overflow-x-auto overflow-y-visible [scrollbar-gutter:stable] scroll-smooth',
    headerRowViewport: 'w-full overflow-hidden',
    columnsTrack: 'flex items-start gap-5 min-w-max',
    columnBase: 'column min-h-96',
    scrollColumn: 'shrink-0 w-64',
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
