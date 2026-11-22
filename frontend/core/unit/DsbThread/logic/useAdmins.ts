import { GATE_PERMISSION } from '@groupher/contracts/gate'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { browserGraphQLRequest } from '~/graphql/client'
import usePagiPosition from '~/hooks/usePagiPosition'
import { viewerQueryKeys } from '~/query'
import { invalidatePrefix } from '~/query/invalidation'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import type { TAdmin, TUser, TUserSearchResult } from '~/spec'
import useAccount from '~/stores/account/hooks'
import useCommunity from '~/stores/community/hooks'
import { useAdminEditor } from '~/stores/dsbShell/editor'
import S from '~/unit/DsbThread/schema/admins'

import { expandAdminPermissions } from './adminPermissions'

type TAdminRequest = {
  id: string
  type: string
  status: string
  decision?: string | null
  revision: number
  proposedPermissions?: Record<string, boolean> | null
  approvedPermissions?: Record<string, boolean> | null
  expiresAt?: string | null
  subjectUser?: TUser | null
  createdBy?: TUser | null
}

const passportActionNames = new Map(
  Object.keys(GATE_PERMISSION).map((action) => [action.replaceAll('.', '_').toUpperCase(), action]),
)

const canonicalPermissions = (permissions: readonly string[]): string[] =>
  permissions.flatMap((permission) => {
    const action = passportActionNames.get(permission) ?? permission
    return Object.hasOwn(GATE_PERMISSION, action) ? [action] : []
  })

const permissionMap = (value: unknown): Record<string, boolean> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => entry[1] === true),
  )
}

/** Pages Passport-backed Admin memberships and owns their revisioned writes. */
export default function useAdmins() {
  const client = useQueryClient()
  const { slug, ref: communityRef = '' } = useCommunity()
  const { accountScope, refreshSession, user } = useAccount()
  const { activeAdmin, setActiveAdmin } = useAdminEditor()
  const position = usePagiPosition(`${accountScope}:${slug}`)
  const prefix = [...viewerQueryKeys.all, accountScope, 'admins', slug]
  const query = useQuery({
    queryKey: [...prefix, position.input],
    queryFn: async () =>
      (await browserGraphQLRequest(S.adminPage, { communityRef, pagi: position.input }))
        .pagedCommunityAdmins,
    enabled: !!communityRef && !!accountScope,
  })

  const invalidate = async (): Promise<void> => {
    await Promise.all([
      invalidatePrefix(client, prefix),
      invalidatePrefix(client, [
        ...viewerQueryKeys.all,
        accountScope,
        'community-admin-requests',
        slug,
      ]),
    ])
    if (activeAdmin?.user.login === user?.login) await refreshSession()
  }

  const grantablePermissions = Object.entries(GATE_PERMISSION)
    .filter(([, permission]) => permission.scope === 'community' && permission.grantable)
    .map(([action]) => action)

  return {
    admins: (query.data?.entries ?? []).map((admin) => ({
      ...admin,
      permissions: canonicalPermissions(admin.permissions as string[]),
    })) as TAdmin[],
    activeAdmin,
    setActiveSettingAdmin: setActiveAdmin,
    pageInfo: query.data?.pageInfo,
    loading: query.isFetching,
    error: query.error,
    retry: query.refetch,
    setPage: position.setPage,
    grantablePermissions,
    searchUsers: async (name: string): Promise<TUserSearchResult[]> => {
      if (!name.trim()) return []
      return (await browserGraphQLRequest(S.searchUsers, { name: name.trim(), communityRef }))
        .adminCandidates as TUserSearchResult[]
    },
    requests: async (): Promise<TAdminRequest[]> => {
      if (!communityRef) return []
      const entries = (
        await browserGraphQLRequest(S.adminRequests, {
          communityRef,
          pagi: { offset: { page: 1, size: 50 } },
        })
      ).pagedCommunityAdminRequests.entries
      return entries.map((entry) => ({
        ...entry,
        proposedPermissions: permissionMap(entry.proposedPermissions),
        approvedPermissions: permissionMap(entry.approvedPermissions),
      })) as TAdminRequest[]
    },
    addAdmins: async (
      users: TUserSearchResult[],
      permissions: Record<string, boolean>,
    ): Promise<void> => {
      if (!communityRef || !users.length) return
      const selectedPermissions = expandAdminPermissions(
        Object.keys(permissions).filter((permission) => permissions[permission]),
      )
      await Promise.all(
        [...new Set(users.map((item) => item.login).filter(Boolean))].map((subjectLogin) =>
          executeCommand({
            request: (variables) => browserGraphQLRequest(S.createAdminRequest, variables),
            variables: {
              communityRef,
              type: 'invite',
              subjectLogin,
              permissions: selectedPermissions,
            },
          }),
        ),
      )
      await invalidate()
    },
    updatePermissions: async (
      memberId: string,
      revision: number,
      permissions: Record<string, boolean>,
    ): Promise<void> => {
      if (!communityRef) return
      await executeCommand({
        request: (variables) => browserGraphQLRequest(S.updateAdminPermissions, variables),
        variables: { communityRef, memberId, revision, permissions: JSON.stringify(permissions) },
      })
      await invalidate()
    },
    removeAdmin: async (memberId: string, revision: number): Promise<void> => {
      if (!communityRef) return
      await executeCommand({
        request: (variables) => browserGraphQLRequest(S.removeAdmin, variables),
        variables: { communityRef, memberId, revision },
      })
      await invalidate()
    },
    decideRequest: async (
      requestId: string,
      revision: number,
      decision: string,
      approvedPermissions?: Record<string, boolean>,
    ): Promise<void> => {
      await executeCommand({
        request: (variables) => browserGraphQLRequest(S.decideAdminRequest, variables),
        variables: {
          requestId,
          revision,
          decision,
          approvedPermissions:
            approvedPermissions === undefined ? undefined : JSON.stringify(approvedPermissions),
        },
      })
      await invalidate()
    },
    cancelRequest: async (requestId: string, revision: number): Promise<void> => {
      await executeCommand({
        request: (variables) => browserGraphQLRequest(S.cancelAdminRequest, variables),
        variables: { requestId, revision },
      })
      await invalidate()
    },
  }
}
