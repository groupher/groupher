import type { FC } from 'react'

import ResetSVG from '~/icons/Reset'
import DubbleCheckSVG from '~/icons/DubbleCheck'
import SearchSVG from '~/icons/HeaderSearch'
import { CONDITION_MODE } from '~/const/mode'

import Input from '~/widgets/Input'
import Button from '~/widgets/Buttons/Button'
import ConditionSelector from '~/widgets/ConditionSelector'

import ActionBar from './ActionBar'

import useCMSInfo from '../../hooks/useCMSInfo'
import useSalon, { cn } from '../../salon/cms/filter_bar'

type TProps = {
  triggerCheckbox: (show: boolean) => void
  checkboxActive: boolean
  selectedCount: number
}

const FilterBar: FC<TProps> = ({ checkboxActive, triggerCheckbox, selectedCount }) => {
  const s = useSalon()

  const { batchSelectAll } = useCMSInfo()

  return (
    <div className={s.wrapper}>
      <div className={s.main}>
        <Button
          size="small"
          className="w-24 min-w-24"
          left={-5}
          onClick={() => {
            if (checkboxActive) {
              batchSelectAll(false)
            }
            triggerCheckbox(!checkboxActive)
          }}
          ghost
          noBorder
        >
          <DubbleCheckSVG className={s.icon} />
          {checkboxActive && '取消'}
          选择
        </Button>

        <div className={s.inputWrapper}>
          <SearchSVG className={cn(s.icon, 'absolute left-2 top-2')} />
          <Input placeholder="按标题搜索" className={s.input} />
        </div>

        <ConditionSelector mode={CONDITION_MODE.CAT} selected={false} right={20} />
        <ConditionSelector mode={CONDITION_MODE.STATE} selected={false} right={20} />

        <div className={s.dateRange}>日期范围(TODO)</div>
        <div className="grow" />
        <Button size="small" className="w-24" ghost noBorder>
          <ResetSVG className={s.icon} />
          重置
        </Button>
      </div>
      {checkboxActive && selectedCount > 0 && (
        <ActionBar
          selectedCount={selectedCount}
          onCancel={() => {
            batchSelectAll(false)
            triggerCheckbox(false)
          }}
        />
      )}
    </div>
  )
}

export default FilterBar
