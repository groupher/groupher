import { find, forEach, reject, uniq } from 'ramda'
import { useMemo, useState } from 'react'

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

const safeParseRules = (rules: string): Record<string, boolean> => {
  try {
    return parseRules(rules)
  } catch (error) {
    console.error('## parse passport rules error: ', error)
    return {}
  }
}

type TPassportJson = Record<string, unknown>

const safeParsePassport = (passport: string): TPassportJson => {
  try {
    const parsed = JSON.parse(passport)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch (error) {
    console.error('## parse passport error: ', error)
    return {}
  }
}

const ruleKeys = (rules: Record<string, boolean>): string[] => Object.keys(rules)
const enabledRuleKeys = (rules: Record<string, boolean>): string[] =>
  Object.entries(rules)
    .filter(([, enabled]) => enabled)
    .map(([rule]) => rule)

const ruleMapFrom = (rules: unknown): Record<string, boolean> =>
  typeof rules === 'object' && rules !== null ? (rules as Record<string, boolean>) : {}

const communityPassportFrom = (
  passport: Record<string, unknown>,
  community: string,
): Record<string, unknown> => {
  if (!community) return {}

  const rules = passport[community]
  return typeof rules === 'object' && rules !== null ? (rules as Record<string, unknown>) : {}
}

const isCommunityRootPassport = (passport: Record<string, unknown>, community: string): boolean =>
  communityPassportFrom(passport, community).root === true

const hasGlobalGod = (user: TUser | null): boolean => user?.passport?.global?.god === true

const hasCommunityRoot = (user: TUser | null, community: string): boolean => {
  if (!user?.passport) return false

  return isCommunityRootPassport(user.passport, community)
}

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
  const [selectedGlobalRules, setSelectedGlobalRules] = useState<string[]>([])
  const [selectedRules, setSelectedRules] = useState<string[]>([])
  const [activeModeratorHasRootPassport, setActiveModeratorHasRootPassport] = useState(false)
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
      setActiveModeratorHasRootPassport(false)
      setLoading(false)
      return
    }

    setLoading(true)
    setSelectedRules([])
    setSelectedGlobalRules([])
    setActiveModeratorHasRootPassport(false)
    query(S.userPassport, { login: activeModerator.login })
      .then((res) => {
        const { passportString = '{}', social = null } = res?.user ?? {}
        const passportJson = safeParsePassport(passportString)
        const globalRules = ruleMapFrom(passportJson.global)
        const communityPassport = communityPassportFrom(passportJson, community$.slug)
        const communityRules = ruleMapFrom(communityPassport.cms)
        const hasRootPassport = isCommunityRootPassport(passportJson, community$.slug)

        if (hasRootPassport) {
          const moderators = dsb$.moderators.map((moderator) =>
            moderator.user?.login === activeModerator.login
              ? { ...moderator, isRoot: true }
              : moderator,
          )

          dsb$.commit({ activeModerator: { ...activeModerator, social }, moderators })
          community$.commit({ moderators })
        } else {
          dsb$.commit({ activeModerator: { ...activeModerator, social } })
        }

        setSelectedGlobalRules(enabledRuleKeys(globalRules))
        setSelectedRules(enabledRuleKeys(communityRules))
        setActiveModeratorHasRootPassport(hasRootPassport)
      })
      .catch((error) => {
        console.error('## load user passport error: ', error)
        setSelectedGlobalRules([])
        setSelectedRules([])
        setActiveModeratorHasRootPassport(false)
        dsb$.commit({ activeModerator: { ...activeModerator, social: null } })
      })
      .finally(() => {
        setLoading(false)
      })
  }

  const loadAllPassportRules = (): void => {
    if (allModeratorRules !== '{}') {
      loadUserPassport()
      return
    }

    setLoading(true)
    query(S.allPassportRules)
      .then((res) => {
        const { cms } = res.allPassportRulesString
        const { general, community } = cms

        dsb$.commit({
          allRootRules: normalizeRules(general),
          allModeratorRules: normalizeRules(community),
        })

        loadUserPassport()
      })
      .catch((error) => {
        console.error('## load passport rules error: ', error)
        setSelectedGlobalRules([])
        setSelectedRules([])
        setLoading(false)
      })
  }

  const updatePassport = (): void => {
    const community = community$.slug
    if (!community || !activeModerator?.login) return

    const innerRules: Record<string, boolean> = {}
    const globalRules: Record<string, boolean> = {}

    forEach(
      (key) => {
        globalRules[key] = false
      },
      ruleKeys(safeParseRules(allRootRules)),
    )
    forEach((key) => {
      globalRules[key] = true
    }, selectedGlobalRules)

    forEach(
      (key) => {
        innerRules[key] = false
      },
      ruleKeys(safeParseRules(allModeratorRules)),
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
      try {
        await revalidateCommunityCache(community)
      } catch (error) {
        console.error('## revalidate community cache error: ', error)
      }
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
        try {
          await revalidateCommunityCache(community$.slug)
        } catch (error) {
          console.error('## revalidate community cache error: ', error)
        }

        closeDrawer()
        send(EVENT.REFRESH_MODERATORS)
      },
    )
  }

  const isActiveModeratorRoot = useMemo(() => {
    const curRoot = find((moderator) => moderator.isRoot, community$.moderators)
    return activeModeratorHasRootPassport || curRoot?.user?.login === activeModerator?.login
  }, [activeModerator, activeModeratorHasRootPassport, community$.moderators])

  const isCurUserModeratorRoot = useMemo(() => {
    if (hasGlobalGod(account$.user)) return true
    if (hasCommunityRoot(account$.user, community$.slug)) return true

    const curRoot = find((moderator) => moderator.isRoot, community$.moderators)
    return curRoot?.user?.login === account$.user?.login
  }, [account$.user, community$.moderators, community$.slug])

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
