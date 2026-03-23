import useKanbanBgColors from '~/hooks/useKanbanBgColors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const [backlogBg, todoBg, wipBg, doneBg, rejectedBg] = useKanbanBgColors()
  const { cn, fg, rainbow } = useTwBelt()

  const body = 'p-2 pb-0 rounded-xl w-full'

  return {
    column: 'column w-[19%] min-w-[19%] min-h-96',
    header: 'row-center pb-4 w-full pl-0.5',
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
