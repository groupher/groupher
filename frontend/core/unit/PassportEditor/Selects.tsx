import { includes } from 'ramda'

import Checker from '~/widgets/Checker'

import useSalon from './salon/selects'
import useLogic from './useLogic'

const THREADS = ['post', 'blog', 'changelog', 'doc']

type TRuleItemProps = {
  ruleKey: string
  title?: string
  checked: boolean
  disabled: boolean
  primary?: boolean
  onChange: (checked: boolean) => void
}

type TRuleSectionProps = {
  rules: string[]
  selectedRules: string[]
  selectAll: boolean
  disabled: boolean
  primary?: boolean
  scope?: 'global' | 'cms'
  onToggle: (rule: string, checked: boolean, scope?: 'global' | 'cms') => void
}

const getRuleKeys = (rules: string): string[] => {
  const optionsJson = JSON.parse(rules)
  return Object.keys(optionsJson)
}

const getThreadRules = (rules: string[]): Record<string, string[]> => {
  return THREADS.reduce(
    (acc, thread) => ({
      ...acc,
      [thread]: rules.filter((rule) => rule.startsWith(`${thread}.`)),
    }),
    {} as Record<string, string[]>,
  )
}

const getContextRules = (rules: string[]): string[] => {
  return rules.filter((rule) => !THREADS.some((thread) => rule.startsWith(`${thread}.`)))
}

const stripThread = (rule: string): string => {
  const thread = THREADS.find((thread) => rule.startsWith(`${thread}.`))
  return thread ? rule.replace(`${thread}.`, '') : rule
}

const getSelectedCount = (rules: string[], selectedRules: string[], selectAll: boolean): number => {
  if (selectAll) return rules.length

  return rules.filter((rule) => includes(rule, selectedRules)).length
}

export default function Selects() {
  const s = useSalon()

  const {
    allRootRules,
    allModeratorRules,
    selectedGlobalRules,
    selectedRules,
    isReadonly,
    isActiveModeratorRoot,
    toggleCheck,
  } = useLogic()
  const globalRules = getRuleKeys(allRootRules)
  const cmsRules = getRuleKeys(allModeratorRules)
  const contextRules = getContextRules(cmsRules)

  const renderRuleItem = ({
    ruleKey,
    title,
    checked,
    disabled,
    primary = false,
    onChange,
  }: TRuleItemProps) => (
    <div className={s.item} key={ruleKey}>
      <Checker
        checked={checked}
        disabled={disabled}
        size='small'
        aria-label={ruleKey}
        onChange={onChange}
      />
      <div className={primary ? s.primaryItemTitle : s.itemTitle} title={ruleKey}>
        {title || ruleKey}
      </div>
    </div>
  )

  const renderRuleGrid = ({
    rules,
    selectedRules,
    selectAll,
    disabled,
    primary = false,
    scope = 'cms',
    onToggle,
  }: TRuleSectionProps) => {
    if (!rules.length) return null

    return (
      <div className={s.groupBody}>
        {rules.map((ruleKey) => {
          const checked = selectAll || includes(ruleKey, selectedRules)

          return renderRuleItem({
            ruleKey,
            checked,
            disabled,
            primary,
            onChange: (checked) => onToggle(ruleKey, checked, scope),
          })
        })}
      </div>
    )
  }

  const renderThreadSections = ({
    rules,
    selectedRules,
    selectAll,
    disabled,
    primary = false,
    scope = 'cms',
    onToggle,
  }: TRuleSectionProps) => {
    const threadRules = getThreadRules(rules)

    return THREADS.map((thread) => {
      const rules = threadRules[thread]
      if (!rules.length) return null
      const selectedCount = getSelectedCount(rules, selectedRules, selectAll)

      return (
        <div className={s.threadGroup} key={thread}>
          <div className={primary ? s.primaryThreadTitle : s.threadTitle}>
            <span>{thread}</span>
            <span className={primary ? s.primaryThreadCount : s.threadCount}>
              ({selectedCount}/{rules.length})
            </span>
          </div>
          <div className={s.threadRules}>
            {rules.map((ruleKey) => {
              const checked = selectAll || includes(ruleKey, selectedRules)

              return renderRuleItem({
                ruleKey,
                title: stripThread(ruleKey),
                checked,
                disabled,
                primary,
                onChange: (checked) => onToggle(ruleKey, checked, scope),
              })
            })}
          </div>
        </div>
      )
    })
  }

  return (
    <div className={s.wrapper}>
      {!!globalRules.length && (
        <section className={s.group}>
          <div className={s.primaryGroupTitle}>Global</div>
          <div className={s.groupPanel}>
            <div className={s.threadedGroupBody}>
              {renderRuleGrid({
                rules: getContextRules(globalRules),
                selectedRules: selectedGlobalRules,
                selectAll: isActiveModeratorRoot,
                disabled: isReadonly,
                primary: true,
                scope: 'global',
                onToggle: toggleCheck,
              })}
              {renderThreadSections({
                rules: globalRules,
                selectedRules: selectedGlobalRules,
                selectAll: isActiveModeratorRoot,
                disabled: isReadonly,
                primary: true,
                scope: 'global',
                onToggle: toggleCheck,
              })}
            </div>
          </div>
        </section>
      )}

      <section className={s.group}>
        <div className={s.groupTitle}>CMS</div>
        <div className={s.groupPanel}>
          <div className={s.threadedGroupBody}>
            {renderRuleGrid({
              rules: contextRules,
              selectedRules,
              selectAll: isActiveModeratorRoot,
              disabled: isReadonly,
              onToggle: toggleCheck,
            })}
            {renderThreadSections({
              rules: cmsRules,
              selectedRules,
              selectAll: isActiveModeratorRoot,
              disabled: isReadonly,
              onToggle: toggleCheck,
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
