'use client'

import { getLocalTimeZone, today } from '@internationalized/date'
import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react'
import {
  Button as AriaButton,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DateRangePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Popover,
  RangeCalendar,
} from 'react-aria-components'

import { CONDITION_MODE } from '~/const/mode'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/Arrow'
import CalendarSVG from '~/icons/Calendar'
import DabbleCheckSVG from '~/icons/DabbleCheck'
import SearchSVG from '~/icons/HeaderSearch'
import ResetSVG from '~/icons/Reset'
import ConditionSelector from '~/unit/ConditionSelector'
import Button from '~/widgets/Buttons/Button'
import Input from '~/widgets/Input'

import useSalon, { cn, cnMerge } from '../salon/cms/filter_bar'
import useActionBarSalon from '../salon/cms/filter_bar/action_bar'
import type { TCmsTableToolbarProps } from './types'

const DEFAULT_DATE_RANGE = (() => {
  const start = today(getLocalTimeZone())

  return {
    start,
    end: start.add({ days: 7 }),
  }
})()

export default function CmsTableToolbar({
  batchActions = null,
  multiSelectEnabled,
  onResetAction = null,
  onToggleMultiSelectAction,
  search = null,
  selectedCount,
  withCategory = false,
  withDateRange = false,
  withReset = true,
  withStatus = false,
  withTags = false,
}: TCmsTableToolbarProps) {
  const s = useSalon()
  const actionBar = useActionBarSalon()
  const { t } = useTrans()
  const showBatchActions = !!batchActions && multiSelectEnabled && selectedCount > 0

  return (
    <div className={s.wrapper}>
      <div className={s.main}>
        <Button
          ariaLabel='Toggle multi-select'
          size='tiny'
          onClick={() => onToggleMultiSelectAction(!multiSelectEnabled)}
          iconOnly
          ghost={!multiSelectEnabled}
        >
          <DabbleCheckSVG className={cnMerge(s.icon, multiSelectEnabled && s.checkActive)} />
        </Button>

        {search && (
          <div className={s.inputWrapper}>
            <SearchSVG className={cn(s.icon, 'absolute left-2 top-2')} />
            <Input
              value={search.value}
              placeholder={search.placeholder ?? t('dsb.cms.filter.search_placeholder')}
              className={s.input}
              onChange={(e) => search.onChangeAction(e.currentTarget.value)}
            />
          </div>
        )}

        {withCategory && <ConditionSelector mode={CONDITION_MODE.CAT} selected={false} />}
        {withStatus && <ConditionSelector mode={CONDITION_MODE.STATUS} selected={false} />}
        {withTags && <ConditionSelector mode={CONDITION_MODE.TAG} selected={false} />}

        {withDateRange && <CmsDateRangePicker label={t('dsb.cms.filter.date_range')} />}

        <div className='grow' />

        {withReset && (
          <Button size='small' ghost noBorder onClick={onResetAction ?? undefined}>
            <ResetSVG className={cn(s.icon, 'mr-1')} />
            {t('dsb.cms.filter.reset')}
          </Button>
        )}
      </div>

      <LazyMotion features={domAnimation}>
        <AnimatePresence initial={false}>
          {showBatchActions && batchActions && (
            <m.div
              key='cms-table-action-bar'
              initial={{ height: 0, marginTop: 0, opacity: 0, y: -6 }}
              animate={{ height: 'auto', marginTop: 16, opacity: 1, y: 0 }}
              exit={{ height: 0, marginTop: 0, opacity: 0, y: -6 }}
              transition={{
                height: { duration: 0.22, ease: 'easeOut' },
                marginTop: { duration: 0.22, ease: 'easeOut' },
                opacity: { duration: 0.16, ease: 'easeOut' },
                y: { duration: 0.18, ease: 'easeOut' },
              }}
              className='overflow-hidden'
            >
              <div className={actionBar.wrapper}>
                <div className={actionBar.main}>
                  <div className={actionBar.note}>
                    {t('dsb.cms.action.selected_prefix')}
                    <div className={actionBar.focus}>{selectedCount}</div>
                    {t('dsb.cms.action.selected_suffix')}
                  </div>

                  {(batchActions.withCategory ||
                    batchActions.withStatus ||
                    batchActions.withTags ||
                    batchActions.withDelete) && (
                    <div className={actionBar.actionNotes}>
                      <div className={actionBar.note}>{t('dsb.cms.action.label')}</div>
                      {batchActions.withCategory && <div className={actionBar.note}>Category</div>}
                      {batchActions.withStatus && (
                        <div className={actionBar.note}>{t('dsb.cms.table.status')}</div>
                      )}
                      {batchActions.withTags && <div className={actionBar.note}>Tags</div>}
                      {batchActions.withDelete && (
                        <div className={actionBar.deleteNote}>{t('dsb.cms.action.delete')}</div>
                      )}
                    </div>
                  )}

                  <div className='grow' />
                  <Button size='small' ghost noBorder onClick={batchActions.onCancelAction}>
                    {t('dsb.cms.action.cancel')}
                  </Button>
                  <div className='mr-1' />
                  <Button size='small' space={2} onClick={batchActions.onConfirmAction}>
                    {t('dsb.cms.action.confirm')}
                  </Button>
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </LazyMotion>
    </div>
  )
}

function CmsDateRangePicker({ label }: { label: string }) {
  const s = useSalon()

  return (
    <DateRangePicker
      aria-label={label}
      className={s.dateRangePicker}
      defaultValue={DEFAULT_DATE_RANGE}
    >
      <Group className={s.dateRangeGroup}>
        <DateInput slot='start' className={s.dateRangeInput}>
          {(segment) => (
            <DateSegment
              segment={segment}
              className={cnMerge(
                s.dateRangeSegment,
                segment.type === 'literal' && s.dateRangeLiteral,
                segment.isPlaceholder && s.dateRangeSegmentPlaceholder,
              )}
            />
          )}
        </DateInput>

        <span className={s.dateRangeDash}>-</span>

        <DateInput slot='end' className={s.dateRangeInput}>
          {(segment) => (
            <DateSegment
              segment={segment}
              className={cnMerge(
                s.dateRangeSegment,
                segment.type === 'literal' && s.dateRangeLiteral,
                segment.isPlaceholder && s.dateRangeSegmentPlaceholder,
              )}
            />
          )}
        </DateInput>

        <AriaButton aria-label={label} className={s.dateRangeTrigger}>
          <CalendarSVG className={s.dateRangeTriggerIcon} />
        </AriaButton>
      </Group>

      <Popover placement='bottom start' offset={8} className={s.dateRangePopover}>
        <Dialog className={s.dateRangeDialog}>
          <RangeCalendar visibleDuration={{ months: 1 }} className={s.dateRangeCalendar}>
            <header className={s.dateRangeCalendarHeader}>
              <AriaButton slot='previous' className={s.dateRangeCalendarNav}>
                <ArrowSVG className={cn(s.dateRangeCalendarNavIcon, s.dateRangeCalendarNavPrev)} />
              </AriaButton>

              <Heading className={s.dateRangeCalendarTitle} />

              <AriaButton slot='next' className={s.dateRangeCalendarNav}>
                <ArrowSVG className={cn(s.dateRangeCalendarNavIcon, s.dateRangeCalendarNavNext)} />
              </AriaButton>
            </header>

            <CalendarGrid className={s.dateRangeCalendarGrid}>
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className={s.dateRangeCalendarWeekHeader}>
                    {day}
                  </CalendarHeaderCell>
                )}
              </CalendarGridHeader>

              <CalendarGridBody>
                {(date) => (
                  <CalendarCell
                    date={date}
                    className={({ isSelected, isSelectionStart, isSelectionEnd, isToday }) =>
                      cnMerge(
                        s.dateRangeCalendarCell,
                        (isSelected || isSelectionStart || isSelectionEnd) &&
                          s.dateRangeCalendarCellActive,
                        !isSelected &&
                          !isSelectionStart &&
                          !isSelectionEnd &&
                          isToday &&
                          s.dateRangeCalendarCellToday,
                      )
                    }
                  />
                )}
              </CalendarGridBody>
            </CalendarGrid>
          </RangeCalendar>
        </Dialog>
      </Popover>
    </DateRangePicker>
  )
}
