import { FIELDS } from '~/constant/dsb-fields'

import type { TDsbShellStore } from './spec'

export const DSB_SHELL_ACTION_KEYS = [
  'edit',
  'editMany',
  'rollback',
  'accept',
  'reconcile',
  'reconcileConfirmed',
  'isTouched',
  'anyTouched',
  'setEditingTag',
  'setSettingTag',
  'setTag',
  'setEditingAlias',
  'setDocFaqSaveZone',
  'setActiveModerator',
  'resetEditor',
] as const satisfies readonly (keyof TDsbShellStore)[]

export const DSB_SHELL_STATE_KEYS = [
  ...(Object.keys(FIELDS) as Array<keyof typeof FIELDS>),
  'original',
  'touchedFields',
  'ui',
  'editingTag',
  'settingTag',
  'editingAlias',
  'docFaqSaveZone',
  'activeModerator',
] as const satisfies readonly (keyof TDsbShellStore)[]
