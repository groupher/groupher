import { useQueryClient } from '@tanstack/react-query'
import type { DocumentNode } from 'graphql'
import { clone, findIndex, includes, values } from 'ramda'
import { useEffect, useRef } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import useDsbTab from '~/hooks/useDsbTab'
import { patchCommunityConfig } from '~/query'
import type { TDsbFieldMap } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import { useDsbEditStore } from '~/stores/dsbEdit/hooks'
import { useFaqEditorUi, useTagEditorUi } from '~/stores/dsbEditorUi/hooks'
import { toast } from '~/ui/Toaster'
import TagsSchema from '~/unit/DsbThread/schema/tags'
import { slugify } from '~/utils/slug'

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
import { buildTagReindexSave, buildTagSave } from './dsb/tags'
import type { TDsbSaveRequest } from './dsb/types'
import useDsbSaveRunner from './useDsbSaveRunner'

const S = TagsSchema

import {
  COMMUNITY_BASEINFO_KEYS,
  BASEINFO_KEYS,
  FAQ_STORE_FIELDS,
  FIELD,
  LAYOUT_FIELD,
  SEO_KEYS,
  TAG_STORE_FIELDS,
} from '~/unit/DsbThread/constant'
import type { TDsbEditableFieldKey, TDsbFieldKey } from '~/unit/DsbThread/spec'

type TRet = {
  mutation: (field: TDsbFieldKey) => void
  mergeBackEditingTag: () => void
  isPending: boolean
  error: Error | null
}

/** Routes editor field intent to its domain request builder and the shared save runner. */
export default function useDsbFieldSave(): TRet {
  const dashboardStore = useDsbEditStore()
  const tagUi$ = useTagEditorUi()
  const faqUi$ = useFaqEditorUi()
  const community$ = useCommunity()
  const { subTab } = useDsbTab()

  const storeRef = useRef(dashboardStore)
  const tagUiRef = useRef(tagUi$)
  const faqUiRef = useRef(faqUi$)
  const { slug: community } = community$
  const queryClient = useQueryClient()
  const { save, isPending, error } = useDsbSaveRunner({ community, dashboardStore })

  const saveContext = () => ({
    community,
    dashboard: storeRef.current,
    original: storeRef.current.original,
  })

  // get latest store, for those state not in UI render cycle
  useEffect(() => {
    tagUiRef.current = tagUi$
    faqUiRef.current = faqUi$
  }, [faqUi$, tagUi$])

  const mergeBackEditingTag = (): void => {
    const { editingTag } = tagUiRef.current
    if (!editingTag) return
    const { tagGroups } = storeRef.current
    const targetIdx = findIndex(
      (item) => item.id === editingTag.id,
      tagGroups.flatMap((group) => group.tags),
    )

    if (targetIdx < 0) return undefined

    const updatedTagGroups = tagGroups.map((group) => ({
      ...group,
      tags: group.tags.map((tag) => (tag.id === editingTag.id ? editingTag : tag)),
    }))

    storeRef.current.editMany({ tagGroups: updatedTagGroups })
    tagUiRef.current.patch({ editingTag: null })

    return undefined
  }

  const resolveSavedFields = (field: TDsbFieldKey): readonly TDsbEditableFieldKey[] => {
    if (field === FIELD.TAG_INDEX || field === FIELD.TAG) return TAG_STORE_FIELDS

    if (field === FIELD.DOC_FAQ) {
      return FAQ_STORE_FIELDS
    }

    if (field === FIELD.BASE_INFO) return BASEINFO_KEYS
    if (field === FIELD.SEO) return SEO_KEYS as readonly TDsbEditableFieldKey[]

    return field in storeRef.current.original ? [field as TDsbEditableFieldKey] : []
  }

  const snapshotFields = (fields: readonly TDsbEditableFieldKey[]): Partial<TDsbFieldMap> => {
    const current = storeRef.current
    const submitted = {} as Partial<TDsbFieldMap>

    for (const field of fields) {
      submitted[field] = clone(current[field]) as never
    }

    if (tagUiRef.current.editingTag && fields.includes(FIELD.TAGS)) {
      submitted.tagGroups = current.tagGroups.map((group) => ({
        ...group,
        tags: group.tags.map((tag) =>
          tag.id === tagUiRef.current.editingTag?.id ? clone(tagUiRef.current.editingTag) : tag,
        ),
      }))
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
    save({
      execute: (commandId) => browserGraphQLRequest<unknown>(schema, { ...params, commandId }),
      field,
      savedFields,
      readConfirmed,
      submitted: snapshotFields(savedFields),
      afterConfirmed: (data) => {
        if (field === FIELD.TAG) mergeBackEditingTag()
        if (field === FIELD.DOC_FAQ) faqUiRef.current.patch({ docFaqSaveZone: null })
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
      const request = buildBaseInfoSave({ ...saveContext(), subTab })
      const savedFields = Object.keys(request.params).filter(
        (key): key is TDsbEditableFieldKey => key !== 'community',
      )
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

          patchCommunityConfig(queryClient, community, communityPatch)
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

    if (field === FIELD.TAG) {
      const { editingTag } = tagUiRef.current
      if (!editingTag) return
      slugify(editingTag.title)
        .then((slug) => {
          tagUiRef.current.patch({ editingTag: { ...editingTag, slug } })
          const request = buildTagSave({
            ...saveContext(),
            editingTag,
            slug,
          })
          handleMutation(field, request.schema, request.params, request.readConfirmed)
        })
        .catch((err) => {
          console.error('## slugify tag title error: ', err)
          toast(String(err), 'error')
        })
      return
    }

    if (field === FIELD.TAG_INDEX) {
      const { activeTagThread } = storeRef.current
      if (!activeTagThread) {
        return
      }
      const request = buildTagReindexSave({
        ...saveContext(),
        activeTagThread,
      })

      const savedFields = resolveSavedFields(field)
      save({
        execute: async () => {
          await Promise.all([
            browserGraphQLRequest(S.reindexCommunityTagGroups, {
              community,
              thread: request.thread,
              groups: [...request.groups],
            }),
            browserGraphQLRequest(S.reindexCommunityTags, {
              community,
              thread: request.thread,
              tags: [...request.tags],
            }),
          ])
        },
        field,
        savedFields,
        submitted: snapshotFields(savedFields),
      })
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
    mergeBackEditingTag,
    isPending,
    error,
  }
}
