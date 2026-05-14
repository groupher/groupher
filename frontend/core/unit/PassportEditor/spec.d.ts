import type { TConstValues, TTransKey } from '~/spec'

import type { PASSPORT_SCOPE } from './constant'

export type TPassportScope = TConstValues<typeof PASSPORT_SCOPE>

export type TStackedRuleGroup = {
  id: string
  titleKey: TTransKey
  fallbackTitle: string
  match?: (rule: string) => boolean
}

export type TTogglePassportRule = (rule: string, checked: boolean, scope?: TPassportScope) => void
