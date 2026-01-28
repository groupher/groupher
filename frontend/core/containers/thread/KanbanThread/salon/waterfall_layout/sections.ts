import useKanbanBgColors from '~/hooks/useKanbanBgColors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const [todoBg, wipBg, doneBg] = useKanbanBgColors()
  const { cn, rainbow, fill, fg } = useTwBelt()

  const head = 'row-center h-10 px-5 rounded-xl w-full'

  return {
    wrapper: cn('column items-start w-full gap-y-10 min-h-96'),
    column: 'column items-start w-full min-h-40',

    //
    content: 'p-2 pb-0 rounded-xl w-full',
    label: cn('text-sm bold-sm ml-2.5', fg('title')),
    count: 'row-center text-xs mt-0.5 ml-2.5 bold-sm',

    todoText: cn('text-xs', rainbow(todoBg, 'fg')),
    wipText: cn('text-xs', rainbow(wipBg, 'fg')),
    doneText: cn('text-xs', rainbow(doneBg, 'fg')),

    todoIcon: cn('size-3', rainbow(todoBg, 'fill')),
    wipIcon: cn('size-3.5', rainbow(wipBg, 'fill')),
    doneIcon: cn('size-3', rainbow(doneBg, 'fill')),
    //
    todoHead: cn(head, rainbow(todoBg, 'bgSoft')),
    wipHead: cn(head, rainbow(wipBg, 'bgSoft')),
    doneHead: cn(head, rainbow(doneBg, 'bgSoft')),
    //
    arrowIcon: cn('size-4 pointer -rotate-90', fill('digest')),
  }
}
