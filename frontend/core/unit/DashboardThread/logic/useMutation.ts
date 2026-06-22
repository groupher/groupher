import { clone, equals, filter, findIndex, includes, keys, omit, values } from 'ramda'
import { useEffect, useRef } from 'react'

import { serializeKanbanBoards } from '~/const/dashboard'
import { DSB_INFO_ROUTE } from '~/const/route'
import useDsbDemoMode from '~/hooks/useDsbDemoMode'
import useDsbTab from '~/hooks/useDsbTab'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import type { TEditValue, TKanbanBoard, TTag } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'
import S from '~/unit/DashboardThread/schema'
import { buildDsbDemoConfig, setDsbDemoConfig } from '~/utils/dsb-demo'
import { revalidateCommunityCache } from '~/utils/revalidateCommunityCache'
import { slugify } from '~/utils/slug'
import { toast } from '~/widgets/Toaster'

import {
  BASEINFO_BASIC_KEYS,
  COMMUNITY_BASEINFO_KEYS,
  BASEINFO_KEYS,
  BASEINFO_OTHER_KEYS,
  FAQ_STORE_FIELDS,
  FIELD,
  LAYOUT_FIELD,
  SEO_KEYS,
  TAG_STORE_FIELDS,
} from '../constant'
import type { TDsbFieldKey, TDsbStoreFieldKey } from '../spec'

type TRet = {
  mutation: (field: string, e: TEditValue) => Promise<void>
  mergeBackEditingTag: () => void
}

export default function useMutation(): TRet {
  const dashboard$ = useDashboard()
  const liveDashboard$ = dashboard$.live$ ?? dashboard$
  const community$ = useCommunity()
  const { mutate } = useGraphQLClient()
  const { subTab } = useDsbTab()
  const isDemoMode = useDsbDemoMode()

  const storeRef = useRef(liveDashboard$)
  const { slug: community } = community$

  // get latest store, for those state not in UI render cycle
  useEffect(() => {
    storeRef.current = liveDashboard$
  }, [liveDashboard$])

  const _findTagIdx = (): number => {
    const { tagGroups, editingTag } = storeRef.current
    const tags = tagGroups.flatMap((group) => group.tags)
    const targetIdx = findIndex((item: TTag) => item.id === editingTag.id, tags)
    return targetIdx
  }

  const mergeBackEditingTag = (): void => {
    const { editingTag, tagGroups } = storeRef.current
    const targetIdx = _findTagIdx()

    if (targetIdx < 0) return undefined

    // store.commit({ editingTag: null })
    const updatedTagGroups = tagGroups.map((group) => ({
      ...group,
      tags: group.tags.map((tag) => (tag.id === editingTag.id ? editingTag : tag)),
    }))

    storeRef.current.commit({ tagGroups: updatedTagGroups, editingTag: null })

    return undefined
  }

  const resolveSavedFields = (field: TDsbFieldKey): readonly TDsbStoreFieldKey[] => {
    if (field === FIELD.TAG_INDEX || field === FIELD.TAG) return TAG_STORE_FIELDS

    if (field === FIELD.DOC_FAQ) {
      return FAQ_STORE_FIELDS
    }

    if (field === FIELD.BASE_INFO) return BASEINFO_KEYS
    if (field === FIELD.SEO) return SEO_KEYS as readonly TDsbStoreFieldKey[]

    return field in storeRef.current.original ? [field as TDsbStoreFieldKey] : []
  }

  const applyOriginal = (field: TDsbFieldKey | null): void => {
    if (!field) return

    const current = storeRef.current
    console.log('## done field: ', field)
    let original = { ...current.original, [field]: clone(current[field]) }
    let storePatch = {}

    if (field === FIELD.TAG_INDEX) {
      original = { ...current.original, tagGroups: clone(current.tagGroups) }
    }

    if (field === FIELD.BASE_INFO) {
      const current = {}

      for (const key of BASEINFO_KEYS) {
        current[key] = clone(storeRef.current[key])
      }
      original = { ...storeRef.current.original, ...current }
    }

    if (field === FIELD.TAG) {
      mergeBackEditingTag()
      original = { ...storeRef.current.original, tagGroups: clone(storeRef.current.tagGroups) }
    }

    if (field === FIELD.SEO) {
      const current = {}

      for (const key of SEO_KEYS) {
        current[key] = clone(storeRef.current[key])
      }
      original = { ...storeRef.current.original, ...current }
    }

    if (field === FIELD.DOC_FAQ) {
      storePatch = { docFaqSaveZone: null }
    }

    const savedFields = resolveSavedFields(field)
    const touchedFields = { ...storeRef.current.touchedFields }

    for (const savedField of savedFields) {
      delete touchedFields[savedField]
    }

    storeRef.current.commit({ ...storePatch, original, touchedFields })
  }

  const _handleDone = (fieldOverride?: TDsbFieldKey): void => {
    const field = (fieldOverride ?? storeRef.current.savingField) as TDsbFieldKey | null
    applyOriginal(field)
    // avoid page component jump caused by saving state
    setTimeout(() => storeRef.current.commit({ saving: false, savingField: null }), 800)
  }

  /**
   * store.savingField is not works in this **Promise** staff
   * not Valtio's thing, this is hte wired React staff
   */
  const handleMutation = (schema, params, okCb = null) => {
    mutate(schema, params)
      .then(async (data) => {
        toast('设置已保存')
        if (okCb) okCb(data)
        try {
          await revalidateCommunityCache(community)
        } catch (err) {
          console.error('## revalidate community cache error: ', err)
        }
        _handleDone()
      })
      .catch((err) => {
        console.error('## handle request error: ', err)
        toast(String(err), 'error')
        storeRef.current.commit({ saving: false, savingField: null })
      })
  }

  const handleDemoMutation = (field: TDsbFieldKey): void => {
    if (field === FIELD.BASE_INFO) {
      const patch = BASEINFO_KEYS.reduce(
        (acc, key) => {
          acc[key] = dashboard$[key]
          return acc
        },
        {} as Record<string, unknown>,
      )

      community$.commit(patch)
    }

    setDsbDemoConfig(buildDsbDemoConfig(storeRef.current))
    toast('设置已保存')
    _handleDone(field)
  }

  const mutation = (field: TDsbFieldKey, _e: TEditValue): Promise<void> => {
    if (isDemoMode) {
      handleDemoMutation(field)
      return Promise.resolve()
    }

    if (field === FIELD.ENABLE) {
      const curEnable = storeRef.current.enable
      const initEnable = storeRef.current.original.enable

      const valueDiff = (key) => !equals(curEnable[key], initEnable[key])

      const diff = filter(valueDiff, keys(curEnable))
      const diffKey = diff[0]
      if (!diffKey) return

      const params = {
        community,
        [diffKey]: curEnable[diffKey],
      }

      handleMutation(S.updateDashboardEnable, params)
      return
    }

    if (field === FIELD.BROADCAST_ENABLE) {
      const params = {
        community,
        broadcastEnable: storeRef.current.broadcastEnable,
      }
      handleMutation(S.updateDashboardLayout, params)
      return
    }

    if (field === FIELD.MEDIA_REPORTS) {
      const { mediaReports } = dashboard$

      const params = {
        community,
        mediaReports: mediaReports.map((item) => omit(['editUrl'], item)),
      }

      handleMutation(S.updateDashboardMediaReports, params)
      return
    }

    if (field === FIELD.HEADER_LINKS) {
      const { headerLinks } = storeRef.current

      handleMutation(S.updateDashboardHeaderLinks, { community, headerLinks })
      return
    }

    if (field === FIELD.FOOTER_LINKS) {
      const { footerLinks } = dashboard$
      handleMutation(S.updateDashboardFooterLinks, { community, footerLinks })
      return
    }

    if (field === FIELD.FOOTER_ONELINE_LINKS) {
      const { footerOnelineLinks } = dashboard$
      handleMutation(S.updateDashboardFooterOnelineLinks, { community, footerOnelineLinks })
      return
    }

    if (field === FIELD.BASE_INFO) {
      const params = { community }

      if (subTab === DSB_INFO_ROUTE.BASIC) {
        for (const key of BASEINFO_BASIC_KEYS) {
          params[key] = dashboard$[key]
        }
      }

      if (subTab === DSB_INFO_ROUTE.OTHER) {
        for (const key of BASEINFO_OTHER_KEYS) {
          params[key] = dashboard$[key]
        }
      }

      handleMutation(S.updateDashboardBaseInfo, params, () => {
        const communityPatch = {}

        for (const key of COMMUNITY_BASEINFO_KEYS) {
          if (params[key] !== undefined) communityPatch[key] = params[key]
        }

        community$.commit(communityPatch)
      })
      return
    }

    if (field === FIELD.SOCIAL_LINKS) {
      const { socialLinks } = dashboard$
      const params = { community, socialLinks }

      handleMutation(S.updateDashboardSocialLinks, params)
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

    //   sr71$.mutate(S.updateDashboardSeo, { community, ...params })
    //   return
    // }

    if (field === FIELD.NAME_ALIAS) {
      const { nameAlias } = storeRef.current
      const params = { community, nameAlias }

      handleMutation(S.updateDashboardNameAlias, params)
      return
    }

    if (field === FIELD.TAG) {
      const { editingTag } = storeRef.current
      slugify(editingTag.title)
        .then((slug) => {
          storeRef.current.commit({ editingTag: { ...editingTag, slug } })
          handleMutation(S.updateCommunityTag, { ...editingTag, slug, community })
        })
        .catch((err) => {
          console.error('## slugify tag title error: ', err)
          toast(String(err), 'error')
          storeRef.current.commit({ saving: false, savingField: null })
        })
      return
    }

    if (field === FIELD.TAG_INDEX) {
      const { activeTagThread, tagGroups } = dashboard$
      if (!activeTagThread) {
        _handleDone()
        return
      }
      const thread = activeTagThread

      const tagIndex = tagGroups.flatMap((group) =>
        group.tags.map((item) => ({
          id: item.id,
          groupId: group.id,
          index: item.index,
        })),
      )
      const groupIndex = tagGroups.map((group) => ({
        id: group.id,
        index: group.index,
      }))

      Promise.all([
        mutate(S.reindexCommunityTagGroups, { community, thread, groups: groupIndex }),
        mutate(S.reindexCommunityTags, { community, thread, tags: tagIndex }),
      ])
        .then(() => _handleDone())
        .catch((err) => {
          console.error('## reindex tags error: ', err)
          toast(String(err), 'error')
          storeRef.current.commit({ saving: false, savingField: null })
        })
      return
    }

    if (field === FIELD.DOC_FAQ) {
      handleMutation(S.updateDashboardDocFaq, { community, docFaq: storeRef.current.docFaq })
      return
    }

    if (includes(field, values(LAYOUT_FIELD))) {
      const currentValue = storeRef.current[field]

      if (field === FIELD.KANBAN_BOARDS) {
        handleMutation(S.updateDashboardLayout, {
          community,
          [field]: serializeKanbanBoards(currentValue as readonly TKanbanBoard[]),
        })
        return
      }

      handleMutation(S.updateDashboardLayout, { community, [field]: currentValue })
      return
    }
  }

  return { mutation, mergeBackEditingTag }
}
