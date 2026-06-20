import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cn, bg, br, fg, fill, hover, primary, rainbow, shadow } = useTwBelt()

  return {
    wrapper: 'w-full h-fit ml-1 pb-5 -mt-3',
    main: 'row-center gap-x-4 w-full',
    inputWrapper: 'relative row-center h-7',
    input: 'pl-7',
    icon: cn('size-3 z-20', primary('fill')),
    checkActive: fill('button.fg'),
    dateRange: cn('text-sm', fg('digest')),
    dateRangePicker: 'shrink-0',
    dateRangeGroup: cn(
      'row-center h-7 min-w-[250px] gap-x-1 rounded-md border px-2.5 text-sm',
      br('table.border'),
      bg('pageBg'),
      fg('digest'),
      shadow('sm'),
    ),
    dateRangeInput: 'row-center min-w-0 gap-x-0.5',
    dateRangeSegment: cn('rounded-sm px-0.5 outline-none', fg('title')),
    dateRangeSegmentPlaceholder: fg('hint'),
    dateRangeLiteral: cn('px-0', fg('digest')),
    dateRangeDash: cn('mx-0.5 text-xs', fg('digest')),
    dateRangeTrigger: cn('align-both size-5 rounded-sm', hover('bg')),
    dateRangeTriggerIcon: cn('size-3.5', fill('digest')),
    dateRangePopover: cn(
      'rounded-xl border p-3',
      br('table.border'),
      bg('popover.bg'),
      shadow('md'),
    ),
    dateRangeDialog: 'outline-none',
    dateRangeCalendar: 'w-[280px]',
    dateRangeCalendarHeader: 'row-between mb-2.5',
    dateRangeCalendarTitle: cn('text-sm bold-sm', fg('title')),
    dateRangeCalendarNav: cn('align-both size-6 rounded-md', hover('bg')),
    dateRangeCalendarNavPrev: 'size-3 rotate-180',
    dateRangeCalendarNavNext: 'size-3',
    dateRangeCalendarNavIcon: fill('digest'),
    dateRangeCalendarGrid: 'w-full border-separate border-spacing-y-1',
    dateRangeCalendarWeekHeader: cn('pb-1 text-xs', fg('hint')),
    dateRangeCalendarCell: cn('align-both size-8 rounded-md text-sm outline-none', fg('digest')),
    dateRangeCalendarCellActive: cn(bg('hoverBg'), fg('title')),
    dateRangeCalendarCellToday: cn('border', br('table.border')),
    actionBarWrapper: cn('w-full pl-2 py-1.5 rounded-md', bg('hoverBg')),
    actionBarMain: 'row-center w-full -ml-2 pl-2.5 pr-0 h-8',
    actionBarNote: cn('row-center text-xs', fg('digest')),
    actionBarFocus: cn('text-sm mx-1 -mt-0.5', rainbow(COLOR.RED, 'fg')),
    actionBarActionNotes: 'row-center ml-1',
    actionBarDeleteNote: cn('text-xs bold ml-2', rainbow(COLOR.RED, 'fg')),
    actionBarSpacer: 'mr-1',
    actionBarPanel: 'overflow-hidden',
    grow: 'grow',
  }
}
