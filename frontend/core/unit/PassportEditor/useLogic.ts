import { find, forEach, reject, uniq } from 'ramda'
import { useMemo, useState } from 'react'

import EVENT from '~/const/event'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import { closeDrawer, send } from '~/signal'
import type { TUser } from '~/spec'
import useAccount from '~/stores/account/hooks'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'

import { PASSPORT_SCOPE } from './constant'
import S from './schema'
import type { TPassportScope, TTogglePassportRule } from './spec'

const normalizeRules = (rules: unknown): string => {
  if (typeof rules === 'string') return rules

  return JSON.stringify(rules ?? {})
}

const parseRules = (rules: string): Record<string, boolean> => JSON.parse(rules)

const ruleKeys = (rules: Record<string, boolean>): string[] => Object.keys(rules)

type TRet = {
  activeModerator: TUser | null
  allRootRules: string
  allModeratorRules: string
  selectedGlobalRules: string[]
  selectedRules: string[]

  toggleCheck: TTogglePassportRule
  loadAllPassportRules: () => void
  updatePassport: () => void

  rules: string
  isActiveModeratorRoot: boolean
  isCurUserModeratorRoot: boolean
  isReadonly: boolean
}

export default function useLogic(): TRet {
  const dsb$ = useDashboard()
  const community$ = useCommunity()
  const account$ = useAccount()
  const { mutate, query } = useGraphQLClient()

  const { activeModerator, allRootRules, allModeratorRules } = dsb$
  const [selectedGlobalRules, setSelectedGlobalRules] = useState([])
  const [selectedRules, setSelectedRules] = useState([])

  const toggleCheck = (
    rule: string,
    checked: boolean,
    scope: TPassportScope = PASSPORT_SCOPE.CMS,
  ): void => {
    const rules = scope === PASSPORT_SCOPE.GLOBAL ? selectedGlobalRules : selectedRules
    const nextRules = checked ? [...rules, rule] : reject((i) => i === rule, rules)

    if (scope === PASSPORT_SCOPE.GLOBAL) {
      setSelectedGlobalRules(uniq(nextRules))
    } else {
      setSelectedRules(uniq(nextRules))
    }
  }

  const loadUserPassport = (): void => {
    if (!activeModerator) return

    setSelectedRules([])
    setSelectedGlobalRules([])
    query(S.userPassport, { login: activeModerator.login }).then((res) => {
      console.log('## load: userPassport: ', res.user)
      const { cmsPassportString } = res.user
      const passportJson = JSON.parse(cmsPassportString)
      const globalRules = passportJson.global
      const communityRules = passportJson.cms?.[community$.slug]

      if (globalRules) {
        setSelectedGlobalRules(ruleKeys(globalRules))
      }

      if (communityRules) {
        setSelectedRules(ruleKeys(communityRules))
      }
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

    const rules = { global: globalRules, cms: { [community]: innerRules } }

    mutate(S.updateModeratorPassport, { community, user: activeModerator.login, rules }).then(
      (res) => {
        console.log('## updateModeratorPassport: ', res)
        closeDrawer()
        send(EVENT.REFRESH_MODERATORS)
      },
    )
  }

  const isActiveModeratorRoot = useMemo(() => {
    const curRoot = find((moderator) => moderator.role === 'root', community$.moderators)
    return curRoot?.user.login === activeModerator?.login
  }, [activeModerator, community$.moderators])

  const isCurUserModeratorRoot = useMemo(() => {
    const curRoot = find((moderator) => moderator.role === 'root', community$.moderators)
    return curRoot?.user.login === account$.user?.login
  }, [account$.user?.login, community$.moderators])

  const rules = useMemo(() => {
    return isActiveModeratorRoot ? allRootRules : allModeratorRules
  }, [isActiveModeratorRoot, allRootRules, allModeratorRules])

  const isReadonly = useMemo(() => {
    return isActiveModeratorRoot || !isCurUserModeratorRoot
  }, [isActiveModeratorRoot, isCurUserModeratorRoot])

  return {
    selectedGlobalRules,
    selectedRules,
    activeModerator,
    allRootRules,
    allModeratorRules,

    toggleCheck,
    loadAllPassportRules,
    updatePassport,

    // TODO:
    rules,
    isActiveModeratorRoot,
    isCurUserModeratorRoot,
    isReadonly,
  }
}
