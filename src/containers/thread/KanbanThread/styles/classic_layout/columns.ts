import useTwBelt from '~/hooks/useTwBelt'
import useKanbanBgColors from '~/hooks/useKanbanBgColors'

export default () => {
  const [todoBg, wipBg, doneBg] = useKanbanBgColors()
  const { cn, fg, rainbow } = useTwBelt()

  const body = 'p-2 pb-0 rounded-xl w-full'

  return {
    column: cn('column w-[32%] min-w-[32%] min-h-96'),
    header: 'row-center pb-4 w-full pl-0.5',
    label: cn('text-base bold ml-2.5', fg('text.digest')),
    subTitle: cn('text-sm ml-1.5', fg('text.hint')),
    //
    todoIcon: cn('size-3', rainbow(todoBg, 'fill')),
    wipIcon: cn('size-3.5', rainbow(wipBg, 'fill')),
    doneIcon: cn('size-3', rainbow(doneBg, 'fill')),
    //
    todoBody: cn(body, rainbow(todoBg, 'bgSoft')),
    wipBody: cn(body, rainbow(wipBg, 'bgSoft')),
    doneBody: cn(body, rainbow(doneBg, 'bgSoft')),
  }
}
