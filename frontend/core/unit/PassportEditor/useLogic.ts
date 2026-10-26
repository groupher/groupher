import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import { viewerQueryKeys } from '~/query'
import { invalidatePrefix } from '~/query/invalidation'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import { closeDrawer } from '~/signal'
import useAccount from '~/stores/account/hooks'
import useCommunity from '~/stores/community/hooks'
import { useModeratorEditorUi } from '~/stores/dsbEditorUi/hooks'
import { toast } from '~/ui/Toaster'

import { PASSPORT_SCOPE } from './constant'
import S from './schema'
import type { TPassportScope } from './spec'

type TRules = Record<string, boolean>
const booleans = (value: unknown): TRules =>
  Object.fromEntries(
    Object.entries(parse(value)).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
    ),
  )
const enabled = (rules: TRules) => Object.keys(rules).filter((key) => rules[key] === true)
const parse = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'string') return JSON.parse(value)
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

/** Owns one selected moderator's permission draft, independently of list pagination. */
export default function useLogic() {
  const client = useQueryClient()
  const account = useAccount()
  const { slug } = useCommunity()
  const ui = useModeratorEditorUi()
  const activeModerator = ui.activeModerator
  const login = activeModerator?.login
  const identity = `${account.accountScope}:${slug}:${login}`
  const prefix = [...viewerQueryKeys.all, account.accountScope]
  const passport = useQuery({
    queryKey: [...prefix, 'moderator-passport', slug, login],
    queryFn: async () => {
      const result = await browserGraphQLRequest(S.userPassport, { login: login! })
      const payload = parse(result.user?.passportString)
      const scoped = parse(payload[slug])
      return {
        global: booleans(payload.global),
        rules: booleans(scoped.cms),
        root: scoped.root === true,
      }
    },
    enabled: !!login && !!slug && !!account.accountScope,
  })
  const registry = useQuery({
    queryKey: [...prefix, 'passport-registry'],
    queryFn: async () =>
      parse((await browserGraphQLRequest(S.allPassportRules)).allPassportRulesString?.cms),
    enabled: !!account.accountScope,
  })
  const current = passport.data ?? { global: {}, rules: {}, root: false }
  const communityRules = current.rules
  const defaults = { global: enabled(current.global ?? {}), cms: enabled(communityRules) }
  const [draft, setDraft] = useState<{ identity: string; global: string[]; cms: string[] } | null>(
    null,
  )
  const selected = draft?.identity === identity ? draft : defaults
  const allRootRules = JSON.stringify(registry.data?.general ?? {})
  const allModeratorRules = JSON.stringify(registry.data?.community ?? {})
  const isActiveModeratorRoot = current.root
  const own = account.user?.passport
  const isCurUserModeratorRoot =
    own?.global?.god === true || (own?.[slug] as { root?: boolean } | undefined)?.root === true
  const [saving, setSaving] = useState(false)
  const invalidate = async () => {
    await Promise.all([
      invalidatePrefix(client, [...prefix, 'moderators', slug]),
      invalidatePrefix(client, [...prefix, 'moderator-passport', slug]),
    ])
    if (login === account.user?.login) await account.refreshSession()
  }
  const run = async (remove: boolean) => {
    if (!login || !slug) return
    setSaving(true)
    try {
      if (remove) {
        await executeCommand({
          request: (variables) => browserGraphQLRequest(S.removeModerator, variables),
          variables: { community: slug, user: login },
        })
      } else {
        const flags = (all: unknown, keys: string[]) =>
          Object.fromEntries(
            [...new Set([...Object.keys(parse(all)), ...keys])].map((key) => [
              key,
              keys.includes(key),
            ]),
          )
        const rules = {
          global: flags(allRootRules, selected.global),
          [slug]: { cms: flags(allModeratorRules, selected.cms) },
        }
        await executeCommand({
          request: (variables) => browserGraphQLRequest(S.updateModeratorPassport, variables),
          variables: { community: slug, user: login, rules: JSON.stringify(rules) },
        })
      }
      await invalidate()
      closeDrawer()
    } catch (error) {
      toast(String(error), 'error')
    } finally {
      setSaving(false)
    }
  }
  return {
    activeModerator,
    allRootRules,
    allModeratorRules,
    selectedGlobalRules: selected.global,
    selectedRules: selected.cms,
    toggleCheck: (rule: string, checked: boolean, scope: TPassportScope = PASSPORT_SCOPE.CMS) => {
      const key = scope === PASSPORT_SCOPE.GLOBAL ? 'global' : 'cms'
      setDraft({
        identity,
        ...selected,
        [key]: checked
          ? [...new Set([...selected[key], rule])]
          : selected[key].filter((item) => item !== rule),
      })
    },
    updatePassport: () => run(false),
    deleteModerator: () => void run(true),
    rules: isActiveModeratorRoot ? allRootRules : allModeratorRules,
    isActiveModeratorRoot,
    isActiveModeratorGod: selected.global.includes('god'),
    isCurUserModeratorRoot,
    isReadonly:
      !isCurUserModeratorRoot ||
      !passport.data ||
      !registry.data ||
      !!passport.error ||
      !!registry.error,
    error: passport.error ?? registry.error,
    retry: () => {
      void passport.refetch()
      void registry.refetch()
    },
    loading: saving || passport.isPending || registry.isPending,
  }
}
