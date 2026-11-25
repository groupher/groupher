import { useQueryClient } from '@tanstack/react-query'
import type { DocumentNode } from 'graphql'
import { clone, includes, values } from 'ramda'

import { browserGraphQLRequest } from '~/graphql/client'
import useDsbTab from '~/hooks/useDsbTab'
import { patchCommunity } from '~/query'
import type { TDsbFieldMap } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import { useFaqEditorState } from '~/stores/dsbShell/editor'
import { useDsbShellSession, useDsbShellStore } from '~/stores/dsbShell/hooks'
import {
  COMMUNITY_BASEINFO_KEYS,
  BASEINFO_KEYS,
  FAQ_STORE_FIELDS,
  FIELD,
  LAYOUT_FIELD,
  SEO_KEYS,
} from '~/unit/DsbThread/constant'
import type { TDsbEditableFieldKey, TDsbFieldKey } from '~/unit/DsbThread/spec'

import {
  buildBaseInfoSave,
  buildDocFaqSave,
  buildEnableSave,
  buildNameAliasSave,
} from './dsb/baseInfo'
import { buildMediaReportsSave, buildThirdPartyAnalyticsSave } from './dsb/integrations'
import { buildBroadcastEnableSave, buildLayoutSave } from './dsb/layout'
import {
  buildFooterLinksSave,
  buildFooterOnelineLinksSave,
  buildHeaderLinksSave,
  buildSocialLinksSave,
} from './dsb/links'
import type { TDsbSaveRequest } from './dsb/types'
import useDsbSaveRunner from './useDsbSaveRunner'

type TRet = {
  mutation: (field: TDsbFieldKey) => void
  isPending: boolean
  error: Error | null
}

/** Routes editor field intent to its domain request builder and the shared save runner. */
export default function useDsbFieldSave(): TRet {
  const dashboardStore = useDsbShellStore()
  const faqEditor = useFaqEditorState()
  const shellSession = useDsbShellSession()
  const community$ = useCommunity()
  const { subTab } = useDsbTab()

  const community = shellSession.community || community$.slug
  const queryClient = useQueryClient()
  const { save, isPending, error } = useDsbSaveRunner({ community })

  const saveContext = () => ({
    community,
    dashboard: dashboardStore,
    original: dashboardStore.original,
  })

  const resolveSavedFields = (field: TDsbFieldKey): readonly TDsbEditableFieldKey[] => {
    if (field === FIELD.DOC_FAQ) {
      return FAQ_STORE_FIELDS
    }

    if (field === FIELD.BASE_INFO) return BASEINFO_KEYS
    if (field === FIELD.SEO) return SEO_KEYS as readonly TDsbEditableFieldKey[]

    return field in dashboardStore.original ? [field as TDsbEditableFieldKey] : []
  }

  const snapshotFields = (
    store: typeof dashboardStore,
    fields: readonly TDsbEditableFieldKey[],
  ): Partial<TDsbFieldMap> => {
    const submitted = {} as Partial<TDsbFieldMap>

    for (const field of fields) {
      submitted[field] = clone(store[field]) as never
    }

    return submitted
  }

  const handleMutation = (
    field: TDsbFieldKey,
    schema: DocumentNode,
    params: Record<string, unknown>,
    readConfirmed?: TDsbSaveRequest['readConfirmed'],
    okCb: ((data: unknown) => void) | null = null,
    savedFields: readonly TDsbEditableFieldKey[] = resolveSavedFields(field),
  ): void => {
    const requestStore = dashboardStore
    const requestCommunity = community
    const requestDemoMode = shellSession.demoMode
    const faqSession = requestStore.docFaqSaveSession

    save({
      community: requestCommunity,
      demoMode: requestDemoMode,
      dashboardStore: requestStore,
      execute: (commandId) => browserGraphQLRequest<unknown>(schema, { ...params, commandId }),
      field,
      savedFields,
      readConfirmed,
      submitted: snapshotFields(requestStore, savedFields),
      afterConfirmed: (data) => {
        if (
          field === FIELD.DOC_FAQ &&
          requestStore.docFaqSaveSession === faqSession &&
          requestStore.docFaqSaveZone === faqEditor.docFaqSaveZone
        ) {
          requestStore.setDocFaqSaveZone(null)
        }
        okCb?.(data)
      },
    })
  }

  const mutation = (field: TDsbFieldKey): void => {
    if (field === FIELD.ENABLE) {
      const request = buildEnableSave(saveContext())
      const changed = Object.keys(request.params).some((key) => key !== 'community')
      if (!changed) return
      handleMutation(field, request.schema, request.params, request.readConfirmed)
      return
    }

    if (field === FIELD.BROADCAST_ENABLE) {
      const request = buildBroadcastEnableSave(saveContext())
      handleMutation(field, request.schema, request.params, request.readConfirmed)
      return
    }

    if (field === FIELD.MEDIA_REPORTS) {
      const request = buildMediaReportsSave(saveContext())
      handleMutation(field, request.schema, request.params, request.readConfirmed)
      return
    }

    if (field === FIELD.THIRD_PARTY_ANALYTICS) {
      const request = buildThirdPartyAnalyticsSave(saveContext())
      handleMutation(field, request.schema, request.params, request.readConfirmed)
      return
    }

    if (field === FIELD.HEADER_LINKS) {
      const request = buildHeaderLinksSave(saveContext())
      handleMutation(field, request.schema, request.params, request.readConfirmed)
      return
    }

    if (field === FIELD.FOOTER_LINKS) {
      const request = buildFooterLinksSave(saveContext())
      handleMutation(field, request.schema, request.params, request.readConfirmed)
      return
    }

    if (field === FIELD.FOOTER_ONELINE_LINKS) {
      const request = buildFooterOnelineLinksSave(saveContext())
      handleMutation(field, request.schema, request.params, request.readConfirmed)
      return
    }

    if (field === FIELD.BASE_INFO) {
      if (!subTab) return
      const request = buildBaseInfoSave({ ...saveContext(), subTab })
      const savedFields = Object.keys(request.params).filter(
        (key): key is TDsbEditableFieldKey => key !== 'community',
      )
      const submittedCommunity = community
      handleMutation(
        field,
        request.schema,
        request.params,
        request.readConfirmed,
        () => {
          const communityPatch = {}

          for (const key of COMMUNITY_BASEINFO_KEYS) {
            if (request.params[key] !== undefined) communityPatch[key] = request.params[key]
          }

          patchCommunity(queryClient, submittedCommunity, communityPatch)
        },
        savedFields,
      )
      return
    }

    if (field === FIELD.SOCIAL_LINKS) {
      const request = buildSocialLinksSave(saveContext())
      handleMutation(field, request.schema, request.params, request.readConfirmed)
      return
    }

    // if (field === FIELD.SEO) {
    //   const params = {}
    //   const { seoTab } = store

    //   if (seoTab === DSB_SEO_ROUTE.SEARCH_ENGINE) {
    //     forEach((key) => {
    //       params[key] = store[key]
    //     }, SEO_OG_KEYS)
    //   }

    //   if (seoTab === DSB_SEO_ROUTE.TWITTER) {
    //     forEach((key) => {
    //       params[key] = store[key]
    //     }, SEO_TW_KEYS)
    //   }

    //   sr71$.browserGraphQLRequest(S.updateDashboardSeo, { community, ...params })
    //   return
    // }

    if (field === FIELD.NAME_ALIAS) {
      const request = buildNameAliasSave(saveContext())
      handleMutation(field, request.schema, request.params, request.readConfirmed)
      return
    }

    if (field === FIELD.DOC_FAQ) {
      const request = buildDocFaqSave(saveContext())
      handleMutation(field, request.schema, request.params, request.readConfirmed)
      return
    }

    if (includes(field, values(LAYOUT_FIELD))) {
      const request = buildLayoutSave({ ...saveContext(), field: field as keyof TDsbFieldMap })
      handleMutation(field, request.schema, request.params, request.readConfirmed)
      return
    }
  }

  return {
    mutation,
    isPending,
    error,
  }
}
