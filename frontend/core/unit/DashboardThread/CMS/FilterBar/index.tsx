import type { FC } from 'react'

import { CONDITION_MODE } from '~/const/mode'
import useTrans from '~/hooks/useTrans'
import DabbleCheckSVG from '~/icons/DabbleCircleCheck'
import SearchSVG from '~/icons/HeaderSearch'
import ResetSVG from '~/icons/Reset'
import ConditionSelector from '~/unit/ConditionSelector'
import Button from '~/widgets/Buttons/Button'
import Input from '~/widgets/Input'

import useSalon, { cn } from '../../salon/cms/filter_bar'
import ActionBar from './ActionBar'

type TProps = {
  triggerCheckbox: (show: boolean) => void
  checkboxActive: boolean
  selectedCount: number
}

const FilterBar: FC<TProps> = ({ checkboxActive, triggerCheckbox, selectedCount }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.main}>
        <Button
          size='small'
          left={-3.5}
          onClick={() => triggerCheckbox(!checkboxActive)}
          ghost
          noBorder
        >
          <DabbleCheckSVG className={s.icon} />
          {checkboxActive && t('dsb.cms.filter.cancel')}
          {t('dsb.cms.filter.multi_select')}
        </Button>

        <div className={s.inputWrapper}>
          <SearchSVG className={cn(s.icon, 'absolute left-2 top-2')} />
          <Input placeholder={t('dsb.cms.filter.search_placeholder')} className={s.input} />
        </div>

        <ConditionSelector mode={CONDITION_MODE.CAT} selected={false} right={10} />
        <ConditionSelector mode={CONDITION_MODE.STATE} selected={false} right={10} />

        <div className={s.dateRange}>{t('dsb.cms.filter.date_range')}</div>
        <div className='grow' />
        <Button size='small' ghost noBorder>
          <ResetSVG className={s.icon} />
          {t('dsb.cms.filter.reset')}
        </Button>
      </div>

      {checkboxActive && selectedCount > 0 && (
        <ActionBar selectedCount={selectedCount} onCancel={() => triggerCheckbox(false)} />
      )}
    </div>
  )
}

export default FilterBar
