import { includes } from 'ramda'

import useTrans from '~/hooks/useTrans'
import type { TTransKey } from '~/spec'

import { PASSPORT_SCOPE, PASSPORT_THREADS, STACKED_RULE_GROUPS } from './constant'
import RuleItem from './RuleItem'
import useSalon from './salon/selects'
import type { TPassportScope, TStackedRuleGroup, TTogglePassportRule } from './spec'
import StackedRuleItem from './StackedRuleItem'
import useLogic from './useLogic'

type TRuleSectionProps = {
  rules: string[]
  selectedRules: string[]
  selectAll: boolean
  disabled: boolean
  primary?: boolean
  scope?: TPassportScope
  onToggle: TTogglePassportRule
}

const getRuleKeys = (rules: string): string[] => {
  const optionsJson = JSON.parse(rules)
  return Object.keys(optionsJson)
}

const getThreadRules = (rules: string[]): Record<string, string[]> => {
  return PASSPORT_THREADS.reduce(
    (acc, thread) => ({
      ...acc,
      [thread]: rules.filter((rule) => rule.startsWith(`${thread}.`)),
    }),
    {} as Record<string, string[]>,
  )
}

const getContextRules = (rules: string[]): string[] => {
  return rules.filter((rule) => !PASSPORT_THREADS.some((thread) => rule.startsWith(`${thread}.`)))
}

const stripThread = (rule: string): string => {
  const thread = PASSPORT_THREADS.find((thread) => rule.startsWith(`${thread}.`))
  return thread ? rule.replace(`${thread}.`, '') : rule
}

const titleizeRule = (rule: string): string => {
  return rule
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const getPassportKey = (type: 'rule' | 'scope' | 'stacked' | 'thread', key: string): TTransKey => {
  return `passport.${type}.${key}` as TTransKey
}

const getSetUnsetGroup = (rule: string): TStackedRuleGroup | undefined => {
  const parts = rule.split('.')
  const action = parts.at(-1)

  if (action !== 'set' && action !== 'unset') return undefined

  const subject = parts.slice(0, -1).join('.')
  if (!subject) return undefined

  return {
    id: `set:${subject}`,
    titleKey: getPassportKey('stacked', `set_${subject.replaceAll('.', '_')}`),
    fallbackTitle: `Set ${titleizeRule(subject)}`,
  }
}

const getUndoGroup = (rule: string, ruleSet: Set<string>): TStackedRuleGroup | undefined => {
  if (rule.startsWith('undo_')) {
    const action = rule.replace('undo_', '')
    return {
      id: `undo:${action}`,
      titleKey: getPassportKey('stacked', action),
      fallbackTitle: titleizeRule(action),
    }
  }

  if (!ruleSet.has(`undo_${rule}`)) return undefined

  return {
    id: `undo:${rule}`,
    titleKey: getPassportKey('stacked', rule),
    fallbackTitle: titleizeRule(rule),
  }
}

const getUnGroup = (rule: string, ruleSet: Set<string>): TStackedRuleGroup | undefined => {
  const parts = rule.split('.')
  const action = parts.at(-1)

  if (!action) return undefined

  const subject = action.startsWith('un')
    ? [...parts.slice(0, -1), action.replace(/^un/, '')].join('.')
    : rule

  if (
    !ruleSet.has(subject) ||
    !ruleSet.has([...parts.slice(0, -1), `un${subject.split('.').at(-1)}`].join('.'))
  ) {
    return undefined
  }

  return {
    id: `un:${subject}`,
    titleKey: getPassportKey('stacked', subject.replaceAll('.', '_')),
    fallbackTitle: titleizeRule(subject),
  }
}

const getStackedGroup = (rule: string, ruleSet: Set<string>): TStackedRuleGroup | undefined => {
  const strippedRule = stripThread(rule)
  const fixedGroup = STACKED_RULE_GROUPS.find((group) => group.match(strippedRule)) as
    | TStackedRuleGroup
    | undefined

  return (
    fixedGroup ||
    getSetUnsetGroup(strippedRule) ||
    getUndoGroup(strippedRule, ruleSet) ||
    getUnGroup(strippedRule, ruleSet)
  )
}

const groupStackedRules = (
  rules: string[],
): Array<string | { group: TStackedRuleGroup; rules: string[] }> => {
  const groups: Record<string, { group: TStackedRuleGroup; rules: string[] }> = {}
  const items: Array<string | { group: TStackedRuleGroup; rules: string[] }> = []
  const ruleSet = new Set(rules.map(stripThread))

  for (const rule of rules) {
    const group = getStackedGroup(rule, ruleSet)

    if (!group) {
      items.push(rule)
      continue
    }

    if (!groups[group.id]) {
      groups[group.id] = { group, rules: [] }
      items.push(groups[group.id])
    }

    groups[group.id].rules.push(rule)
  }

  return items
}

const getSelectedCount = (rules: string[], selectedRules: string[], selectAll: boolean): number => {
  if (selectAll) return rules.length

  return rules.filter((rule) => includes(rule, selectedRules)).length
}

export default function Selects() {
  const s = useSalon()
  const { t } = useTrans()

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

  const translate = (key: TTransKey, fallback: string): string => {
    const translated = t(key)
    return translated === '--' ? fallback : translated
  }

  const translateRule = (rule: string): string => {
    const strippedRule = stripThread(rule)
    return translate(getPassportKey('rule', strippedRule), strippedRule)
  }

  const translateThread = (thread: string): string => {
    return translate(getPassportKey('thread', thread), thread)
  }

  const renderRuleGrid = ({
    rules,
    selectedRules,
    selectAll,
    disabled,
    primary = false,
    scope = PASSPORT_SCOPE.CMS,
    onToggle,
  }: TRuleSectionProps) => {
    if (!rules.length) return null

    return (
      <div className={s.groupBody}>
        {groupStackedRules(rules).map((item) => {
          if (typeof item !== 'string') {
            return (
              <StackedRuleItem
                key={`${scope}:${item.rules[0]}:${item.group.id}`}
                title={translate(item.group.titleKey, item.group.fallbackTitle)}
                rules={item.rules}
                selectedRules={selectedRules}
                selectAll={selectAll}
                disabled={disabled}
                primary={primary}
                scope={scope}
                stripTitle={stripThread}
                translateRule={translateRule}
                onToggle={onToggle}
              />
            )
          }

          const checked = selectAll || includes(item, selectedRules)

          return (
            <RuleItem
              key={item}
              ruleKey={item}
              title={translateRule(item)}
              checked={checked}
              disabled={disabled}
              primary={primary}
              onChange={(checked) => onToggle(item, checked, scope)}
            />
          )
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
    scope = PASSPORT_SCOPE.CMS,
    onToggle,
  }: TRuleSectionProps) => {
    const threadRules = getThreadRules(rules)

    return PASSPORT_THREADS.map((thread) => {
      const rules = threadRules[thread]
      if (!rules.length) return null
      const selectedCount = getSelectedCount(rules, selectedRules, selectAll)

      return (
        <div className={s.threadGroup} key={thread}>
          <div className={primary ? s.primaryThreadTitle : s.threadTitle}>
            <span>{translateThread(thread)}</span>
            <span className={primary ? s.primaryThreadCount : s.threadCount}>
              ({selectedCount}/{rules.length})
            </span>
          </div>
          <div className={s.threadRules}>
            {groupStackedRules(rules).map((item) => {
              if (typeof item !== 'string') {
                return (
                  <StackedRuleItem
                    key={`${scope}:${item.rules[0]}:${item.group.id}`}
                    title={translate(item.group.titleKey, item.group.fallbackTitle)}
                    rules={item.rules}
                    selectedRules={selectedRules}
                    selectAll={selectAll}
                    disabled={disabled}
                    primary={primary}
                    scope={scope}
                    stripTitle={stripThread}
                    translateRule={translateRule}
                    onToggle={onToggle}
                  />
                )
              }

              const checked = selectAll || includes(item, selectedRules)

              return (
                <RuleItem
                  key={item}
                  ruleKey={item}
                  title={translateRule(item)}
                  checked={checked}
                  disabled={disabled}
                  primary={primary}
                  onChange={(checked) => onToggle(item, checked, scope)}
                />
              )
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
          <div className={s.groupHeader}>
            <div className={s.primaryGroupTitle}>
              {translate(getPassportKey('scope', PASSPORT_SCOPE.GLOBAL), 'Global')}
            </div>
            <div className={s.groupDesc}>
              {translate(
                getPassportKey('scope', `${PASSPORT_SCOPE.GLOBAL}.desc`),
                'Permissions that apply across communities and system-level operations.',
              )}
            </div>
          </div>
          <div className={s.groupPanel}>
            <div className={s.threadedGroupBody}>
              {renderRuleGrid({
                rules: getContextRules(globalRules),
                selectedRules: selectedGlobalRules,
                selectAll: isActiveModeratorRoot,
                disabled: isReadonly,
                primary: true,
                scope: PASSPORT_SCOPE.GLOBAL,
                onToggle: toggleCheck,
              })}
              {renderThreadSections({
                rules: globalRules,
                selectedRules: selectedGlobalRules,
                selectAll: isActiveModeratorRoot,
                disabled: isReadonly,
                primary: true,
                scope: PASSPORT_SCOPE.GLOBAL,
                onToggle: toggleCheck,
              })}
            </div>
          </div>
        </section>
      )}

      <section className={s.group}>
        <div className={s.groupHeader}>
          <div className={s.groupTitle}>
            {translate(getPassportKey('scope', PASSPORT_SCOPE.CMS), 'CMS')}
          </div>
          <div className={s.groupDesc}>
            {translate(
              getPassportKey('scope', `${PASSPORT_SCOPE.CMS}.desc`),
              'Permissions scoped to the current community and its content.',
            )}
          </div>
        </div>
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
