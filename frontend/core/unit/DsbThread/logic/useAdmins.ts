import { useQuery, useQueryClient } from '@tanstack/react-query'

import { browserGraphQLRequest } from '~/graphql/client'
import usePagiPosition from '~/hooks/usePagiPosition'
import { viewerQueryKeys } from '~/query'
import { invalidatePrefix } from '~/query/invalidation'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import type { TUser } from '~/spec'
import useAccount from '~/stores/account/hooks'
import useCommunity from '~/stores/community/hooks'
import { useModeratorEditorUi } from '~/stores/dsbEditorUi/hooks'
import S from '~/unit/DsbThread/schema/admins'

/** Pages moderator memberships; permissions are loaded only for the selected editor target. */
export default function useAdmins() {
  const client = useQueryClient()
  const { slug } = useCommunity()
  const { accountScope } = useAccount()
  const ui = useModeratorEditorUi()
  const position = usePagiPosition(`${accountScope}:${slug}`)
  const prefix = [...viewerQueryKeys.all, accountScope, 'moderators', slug]
  const query = useQuery({
    queryKey: [...prefix, position.input],
    queryFn: async () =>
      (await browserGraphQLRequest(S.moderatorPage, { community: slug, pagi: position.input }))
        .pagedCommunityModerators,
    enabled: !!slug && !!accountScope,
  })
  return {
    moderators: query.data?.entries ?? [],
    activeModerator: ui.activeModerator,
    setActiveSettingAdmin: (user: TUser) => ui.patch({ activeModerator: user }),
    pageInfo: query.data?.pageInfo,
    loading: query.isFetching,
    error: query.error,
    retry: query.refetch,
    setPage: position.setPage,
    searchUsers: async (name: string): Promise<TUser[]> => {
      if (!name.trim()) return []
      return (await browserGraphQLRequest(S.searchUsers, { name: name.trim(), community: slug }))
        .moderatorCandidates as TUser[]
    },
    addAdmins: async (users: TUser[]): Promise<void> => {
      const logins = [...new Set(users.map((user) => user.login).filter(Boolean))]
      if (!slug || !logins.length) return
      await executeCommand({
        request: (variables) => browserGraphQLRequest(S.addModerators, variables),
        variables: { community: slug, users: logins },
      })
      await invalidatePrefix(client, prefix)
    },
  }
}
