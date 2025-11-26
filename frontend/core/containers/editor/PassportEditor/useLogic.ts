import { find, forEach, keys, reject, uniq } from 'ramda'
import { useCallback, useState } from 'react'
import EVENT from '~/const/event'
import useAccount from '~/hooks/useAccount'
import useDashboard from '~/hooks/useDashboard'
import useViewingCommunity from '~/hooks/useViewingCommunity'
import { mutate, query } from '~/server'
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
  // drived
  getRules: () => string
  getIsActiveModeratorRoot: () => boolean
  getIsCurUserModeratorRoot: () => boolean
  getIsReadonly: () => boolean
}

export default (): TRet => {
  const dashbaord = useDashboard()
  const curCommunity = useViewingCommunity()
  const account = useAccount()
  const [selectedRules, setSelectedRules] = useState([])

  const { activeModerator, allRootRules, allModeratorRules } = dashbaord

  const toggleCheck = (rule: string, checked: boolean): void => {
    const _selectedRules = checked
      ? [...selectedRules, rule]
      : reject((i) => i === rule, selectedRules)

    setSelectedRules(uniq(_selectedRules))
  }

  const loadUserPassport = (): void => {
    setSelectedRules([])
    query(S.userPassport, { login: activeModerator.login }).then((res) => {
      console.log('## load: userPassport: ', res.user)
      const { cmsPassportString } = res.user
      const passportJson = JSON.parse(cmsPassportString)

      if (passportJson[curCommunity.slug]) {
        setSelectedRules(keys(passportJson[curCommunity.slug]))
      }
    })
  }

  const loadAllPassportRules = (): void => {
    if (allModeratorRules !== '{}') {
      loadUserPassport()
      return
    }

    query(S.allPassportRules).then((res) => {
      const { moderator, root } = res.allPassportRules

      dashbaord.commit({ allRootRules: root, allModeratorRules: moderator })
    })
  }

  const updatePassport = (): void => {
    const community = curCommunity.slug

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

  // drived
  const getIsActiveModeratorRoot = useCallback((): boolean => {
    const curModerators = curCommunity.moderators
    const curRoot = find((moderator) => moderator.role === 'root', curModerators)

    return curRoot.user.login === activeModerator?.login
  }, [activeModerator, curCommunity])

  const getIsCurUserModeratorRoot = useCallback((): boolean => {
    const curModerators = curCommunity.moderators
    const curRoot = find((moderator) => moderator.role === 'root', curModerators)

    return curRoot.user.login === account.login
  }, [curCommunity, account])

  const getRules = useCallback((): string => {
    return getIsActiveModeratorRoot() ? allRootRules : allModeratorRules
  }, [getIsActiveModeratorRoot, allRootRules, allModeratorRules])

  const getIsReadonly = useCallback((): boolean => {
    return getIsActiveModeratorRoot() || !getIsCurUserModeratorRoot()
  }, [getIsCurUserModeratorRoot, getIsActiveModeratorRoot])

  return {
    selectedRules,
    activeModerator,
    allRootRules,
    allModeratorRules,

    toggleCheck,
    loadAllPassportRules,
    updatePassport,

    // drived
    getRules,
    getIsActiveModeratorRoot,
    getIsCurUserModeratorRoot,
    getIsReadonly,
  }
}
