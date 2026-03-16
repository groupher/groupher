import { find, forEach, keys, reject, uniq } from 'ramda'
import { useMemo, useState } from 'react'
import EVENT from '~/const/event'
import useAccount from '~/hooks/useAccount'
import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import { closeDrawer, send } from '~/signal'
import type { TUser } from '~/spec'

import S from './schema'

type TRet = {
  activeModerator: TUser | null
  allRootRules: string
  allModeratorRules: string
  selectedRules: string[]

  toggleCheck: (rule: string, checked: boolean) => void
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
  const [selectedRules, setSelectedRules] = useState([])

  const toggleCheck = (rule: string, checked: boolean): void => {
    const _selectedRules = checked
      ? [...selectedRules, rule]
      : reject((i) => i === rule, selectedRules)

    setSelectedRules(uniq(_selectedRules))
  }

  const loadUserPassport = (): void => {
    setSelectedRules([])
    query(S.userPassport, { login: activeModerator.login }).then((res) => {
      // @ts-expect-error
      console.log('## load: userPassport: ', res.user)
      // @ts-expect-error
      const { cmsPassportString } = res.user
      const passportJson = JSON.parse(cmsPassportString)

      if (passportJson[community$.slug]) {
        setSelectedRules(keys(passportJson[community$.slug]))
      }
    })
  }

  const loadAllPassportRules = (): void => {
    if (allModeratorRules !== '{}') {
      loadUserPassport()
      return
    }

    query(S.allPassportRules).then((res) => {
      // @ts-expect-error
      const { moderator, root } = res.allPassportRules

      dsb$.commit({ allRootRules: root, allModeratorRules: moderator })
    })
  }

  const updatePassport = (): void => {
    const community = community$.slug

    const innerRules = {}
    forEach(
      (key) => {
        innerRules[key] = false
      },
      keys(JSON.parse(allModeratorRules)),
    )
    forEach((key) => {
      innerRules[key] = true
    }, selectedRules)

    const rules = JSON.stringify({ [community]: innerRules })

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
    return curRoot?.user.login === account$.user.login
  }, [account$.user.login, community$.moderators])

  const rules = useMemo(() => {
    return isActiveModeratorRoot ? allRootRules : allModeratorRules
  }, [isActiveModeratorRoot, allRootRules, allModeratorRules])

  const isReadonly = useMemo(() => {
    return isActiveModeratorRoot || !isCurUserModeratorRoot
  }, [isActiveModeratorRoot, isCurUserModeratorRoot])

  return {
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
