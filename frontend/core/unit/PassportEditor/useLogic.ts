import { find, forEach, reject, uniq } from 'ramda'
import { useMemo, useState } from 'react'

import { ADMIN_ROLE } from '~/const/dashboard'
import EVENT from '~/const/event'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import { closeDrawer, send } from '~/signal'
import type { TUser } from '~/spec'
import useAccount from '~/stores/account/hooks'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import { revalidateCommunityCache } from '~/utils/revalidateCommunityCache'

import { PASSPORT_SCOPE } from './constant'
import S from './schema'
import type { TPassportScope, TTogglePassportRule } from './spec'

const normalizeRules = (rules: unknown): string => {
  if (typeof rules === 'string') return rules

  return JSON.stringify(rules ?? {})
}

const parseRules = (rules: string): Record<string, boolean> => JSON.parse(rules)

const ruleKeys = (rules: Record<string, boolean>): string[] => Object.keys(rules)
const enabledRuleKeys = (rules: Record<string, boolean>): string[] =>
  Object.entries(rules)
    .filter(([, enabled]) => enabled)
    .map(([rule]) => rule)

const hasGlobalGod = (user: TUser | null): boolean => user?.cmsPassport?.global?.god === true

type TRet = {
  activeModerator: TUser | null
  allRootRules: string
  allModeratorRules: string
  selectedGlobalRules: string[]
  selectedRules: string[]

  toggleCheck: TTogglePassportRule
  loadAllPassportRules: () => void
  updatePassport: () => void
  deleteModerator: () => void

  rules: string
  isActiveModeratorRoot: boolean
  isActiveModeratorGod: boolean
  isCurUserModeratorRoot: boolean
  isReadonly: boolean
  loading: boolean
}

export default function useLogic(): TRet {
  const dsb$ = useDashboard()
  const community$ = useCommunity()
  const account$ = useAccount()
  const { mutate, query } = useGraphQLClient()

  const { activeModerator, allRootRules, allModeratorRules } = dsb$
  const [selectedGlobalRules, setSelectedGlobalRules] = useState([])
  const [selectedRules, setSelectedRules] = useState([])
  const [loading, setLoading] = useState(true)

  const toggleCheck = (
    rule: string,
    checked: boolean,
    scope: TPassportScope = PASSPORT_SCOPE.CMS,
  ): void => {
    if (scope === PASSPORT_SCOPE.GLOBAL) {
      setSelectedGlobalRules((rules) =>
        uniq(checked ? [...rules, rule] : reject((i) => i === rule, rules)),
      )
    } else {
      setSelectedRules((rules) =>
        uniq(checked ? [...rules, rule] : reject((i) => i === rule, rules)),
      )
    }
  }

  const loadUserPassport = (): void => {
    if (!activeModerator) {
      setLoading(false)
      return
    }

    setLoading(true)
    setSelectedRules([])
    setSelectedGlobalRules([])
    query(S.userPassport, { login: activeModerator.login }).then((res) => {
      const { cmsPassportString, social } = res.user
      const passportJson = JSON.parse(cmsPassportString)
      const globalRules = passportJson.global
      const communityRules = passportJson[community$.slug]?.cms

      dsb$.commit({ activeModerator: { ...activeModerator, social } })

      if (globalRules) {
        setSelectedGlobalRules(enabledRuleKeys(globalRules))
      }

      if (communityRules) {
        setSelectedRules(enabledRuleKeys(communityRules))
      }
      setLoading(false)
    })
  }

  const loadAllPassportRules = (): void => {
    if (allModeratorRules !== '{}') {
      loadUserPassport()
      return
    }

    query(S.allPassportRules).then((res) => {
      const { cms } = res.allPassportRulesString
      const { general, community } = cms

      dsb$.commit({
        allRootRules: normalizeRules(general),
        allModeratorRules: normalizeRules(community),
      })

      loadUserPassport()
    })
  }

  const updatePassport = (): void => {
    const community = community$.slug

    const innerRules: Record<string, boolean> = {}
    const globalRules: Record<string, boolean> = {}

    forEach(
      (key) => {
        globalRules[key] = false
      },
      ruleKeys(parseRules(allRootRules)),
    )
    forEach((key) => {
      globalRules[key] = true
    }, selectedGlobalRules)

    forEach(
      (key) => {
        innerRules[key] = false
      },
      ruleKeys(parseRules(allModeratorRules)),
    )
    forEach((key) => {
      innerRules[key] = true
    }, selectedRules)

    const rules = { global: globalRules, [community]: { cms: innerRules } }

    mutate(S.updateModeratorPassport, {
      community,
      user: activeModerator.login,
      rules: JSON.stringify(rules),
    }).then(async (res) => {
      const moderators = (res.updateModeratorPassport?.moderators ?? []).filter(
        (moderator) => moderator.user?.login,
      )

      dsb$.commit({ moderators })
      community$.commit({ moderators })
      await revalidateCommunityCache(community)
      closeDrawer()
    })
  }

  const deleteModerator = (): void => {
    if (!activeModerator?.login) return

    mutate(S.removeModerator, { community: community$.slug, user: activeModerator.login }).then(
      async (res) => {
        const moderators = (res.removeModerator?.moderators ?? []).filter(
          (moderator) => moderator.user?.login,
        )

        dsb$.commit({ moderators, activeModerator: null })
        community$.commit({ moderators })
        await revalidateCommunityCache(community$.slug)

        closeDrawer()
        send(EVENT.REFRESH_MODERATORS)
      },
    )
  }

  const isActiveModeratorRoot = useMemo(() => {
    const curRoot = find((moderator) => moderator.role === ADMIN_ROLE.ROOT, community$.moderators)
    return curRoot?.user?.login === activeModerator?.login
  }, [activeModerator, community$.moderators])

  const isCurUserModeratorRoot = useMemo(() => {
    if (hasGlobalGod(account$.user)) return true

    const curRoot = find((moderator) => moderator.role === ADMIN_ROLE.ROOT, community$.moderators)
    return curRoot?.user?.login === account$.user?.login
  }, [account$.user, community$.moderators])

  const rules = useMemo(() => {
    return isActiveModeratorRoot ? allRootRules : allModeratorRules
  }, [isActiveModeratorRoot, allRootRules, allModeratorRules])

  const isActiveModeratorGod = useMemo(() => {
    return selectedGlobalRules.includes('god')
  }, [selectedGlobalRules])

  const isReadonly = useMemo(() => {
    return !isCurUserModeratorRoot
  }, [isCurUserModeratorRoot])

  return {
    selectedGlobalRules,
    selectedRules,
    activeModerator,
    allRootRules,
    allModeratorRules,

    toggleCheck,
    loadAllPassportRules,
    updatePassport,
    deleteModerator,

    // TODO:
    rules,
    isActiveModeratorRoot,
    isActiveModeratorGod,
    isCurUserModeratorRoot,
    isReadonly,
    loading,
  }
}
