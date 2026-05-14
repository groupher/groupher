import { useCallback, useMemo } from 'react'

import { sortByKey } from '~/helper'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import type { TModerator, TUser } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import { revalidateCommunityCache } from '~/utils/revalidateCommunityCache'

import S from '../schema'

type TRet = {
  moderators: TModerator[]
  activeModerator: TUser | null
  setActiveSettingAdmin: (user: TUser) => void
  searchUsers: (name: string) => Promise<TUser[]>
  addAdmins: (users: TUser[]) => Promise<void>
  isModerator: (user: TUser | null) => boolean
}

export default function useAdmins(): TRet {
  const dsb$ = useDashboard()
  const community$ = useCommunity()
  const { query, mutate } = useGraphQLClient()
  const { moderators: originalModerators, activeModerator } = dsb$

  const moderators = useMemo(() => {
    return sortByKey(
      originalModerators.filter((moderator) => moderator.user?.login),
      'passportItemCount',
    ).reverse() as TModerator[]
  }, [originalModerators])

  const setActiveSettingAdmin = (user: TUser): void => dsb$.commit({ activeModerator: user })
  const isModerator = useCallback(
    (user: TUser | null): boolean => {
      if (!user?.login) return false
      return originalModerators.some((moderator) => moderator.user?.login === user.login)
    },
    [originalModerators],
  )

  const searchUsers = useCallback(
    async (name: string): Promise<TUser[]> => {
      const keyword = name.trim()
      if (!keyword) return []

      const data = await query<{ searchUsers: { entries: TUser[] } }, { name: string }>(
        S.searchUsers,
        { name: keyword },
      )

      return data.searchUsers.entries.filter(
        (user) => user.login && !originalModerators.some((item) => item.user?.login === user.login),
      )
    },
    [originalModerators, query],
  )

  const addAdmins = useCallback(
    async (users: TUser[]): Promise<void> => {
      const validUsers = users.filter((user) => user.login && !isModerator(user))
      if (!community$.slug || !validUsers.length) return

      const data = await mutate<
        { addModerators: { moderators: TModerator[] } },
        { community: string; users: string[] }
      >(S.addModerators, {
        community: community$.slug,
        users: validUsers.map((user) => user.login!),
      })

      const pendingLogins = new Set(validUsers.map((user) => user.login))
      const remoteModerators = data.addModerators.moderators ?? []
      const nextModerators = remoteModerators.flatMap((moderator) => {
        const login = moderator.user?.login
        if (!login) return []

        return [
          {
            ...moderator,
            pending: pendingLogins.has(login),
          },
        ]
      })

      const fallbackModerators = [
        ...originalModerators,
        ...validUsers.map((user) => ({
          isRoot: false,
          passportItemCount: 0,
          user,
          pending: true,
        })),
      ]

      const resolvedModerators = nextModerators.length ? nextModerators : fallbackModerators

      dsb$.commit({ moderators: resolvedModerators })
      community$.commit({ moderators: resolvedModerators })
      try {
        await revalidateCommunityCache(community$.slug)
      } catch (error) {
        console.error('## revalidate community cache error: ', error)
      }
    },
    [community$, dsb$, isModerator, mutate, originalModerators],
  )

  return {
    moderators,
    activeModerator,
    setActiveSettingAdmin,
    searchUsers,
    addAdmins,
    isModerator,
  }
}
