import { includes } from 'ramda'
import { useState } from 'react'

import Checker from '~/widgets/Checker'
import Tooltip from '~/widgets/Tooltip'

import { PASSPORT_SCOPE } from './constant'
import RuleItem from './RuleItem'
import useSalon from './salon/stacked_rule_item'
import type { TPassportScope, TTogglePassportRule } from './spec'

type TProps = {
  title: string
  rules: string[]
  selectedRules: string[]
  selectAll: boolean
  disabled: boolean
  primary?: boolean
  scope?: TPassportScope
  stripTitle?: (rule: string) => string
  translateRule?: (rule: string) => string
  onToggle: TTogglePassportRule
}

const getSelectedCount = (rules: string[], selectedRules: string[], selectAll: boolean): number => {
  if (selectAll) return rules.length

  return rules.filter((rule) => includes(rule, selectedRules)).length
}

function RuleCountBars({
  selectedCount,
  totalCount,
  completed,
  s,
}: {
  selectedCount: number
  totalCount: number
  completed: boolean
  s: ReturnType<typeof useSalon>
}) {
  const activeBarClass = completed ? s.itemBarDone : s.itemBarPartial

  return (
    <div className={s.itemBars} aria-label={`${selectedCount}/${totalCount}`}>
      {Array.from({ length: totalCount }, (_, index) => index).map((index) => (
        <span
          key={index}
          className={`${s.itemBar} ${index < selectedCount ? activeBarClass : s.itemBarEmpty}`}
        />
      ))}
    </div>
  )
}

export default function StackedRuleItem({
  title,
  rules,
  selectedRules,
  selectAll,
  disabled,
  primary = false,
  scope = PASSPORT_SCOPE.CMS,
  stripTitle = (rule) => rule,
  translateRule = (rule) => rule,
  onToggle,
}: TProps) {
  const [active, setActive] = useState(false)
  const selectedCount = getSelectedCount(rules, selectedRules, selectAll)
  const checked = selectedCount === rules.length
  const indeterminate = selectedCount > 0 && selectedCount < rules.length
  const completed = selectedCount === rules.length
  const s = useSalon({ active })

  const detailPanel = (
    <div className={s.detailPanel}>
      <div className={primary ? s.primaryDetailTitle : s.detailTitle}>{title}</div>
      <div className={s.detailList}>
        {rules.map((ruleKey) => {
          const checked = selectAll || includes(ruleKey, selectedRules)

          return (
            <RuleItem
              key={ruleKey}
              ruleKey={ruleKey}
              title={translateRule(stripTitle(ruleKey))}
              checked={checked}
              disabled={disabled}
              primary={primary}
              onChange={(checked) => onToggle(ruleKey, checked, scope)}
            />
          )
        })}
      </div>
    </div>
  )

  return (
    <div className={s.wrapper}>
      <Checker
        checked={checked}
        indeterminate={indeterminate}
        disabled={disabled}
        size='small'
        aria-label={title}
        onChange={(checked) => {
          for (const rule of rules) {
            onToggle(rule, checked, scope)
          }
        }}
      />
      <div className={primary ? s.primaryItemTitle : s.itemTitle}>{title}</div>
      <Tooltip
        placement='bottom'
        offset={[-55, 0]}
        maxWidth={180}
        hideOnClick={false}
        noPadding
        onShow={() => setActive(true)}
        onHide={() => setActive(false)}
        content={detailPanel}
      >
        <RuleCountBars
          selectedCount={selectedCount}
          totalCount={rules.length}
          completed={completed}
          s={s}
        />
      </Tooltip>
    </div>
  )
}
