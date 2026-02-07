import { equals, filter, findIndex, includes, keys, omit, update, values } from 'ramda'
import { useEffect, useRef } from 'react'
import { DSB_INFO_ROUTE } from '~/const/route'
import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard'
import useDsbDemoMode from '~/hooks/useDsbDemoMode'
import useDsbTab from '~/hooks/useDsbTab'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import { toast } from '~/signal'
import type { TEditValue, TTag } from '~/spec'
import { buildDsbDemoConfig, setDsbDemoConfig } from '~/utils/dsb-demo'
import {
  BASEINFO_BASIC_KEYS,
  BASEINFO_KEYS,
  BASEINFO_OTHER_KEYS,
  FIELD,
  LAYOUT_FIELD,
  SEO_KEYS,
} from '../constant'
import S from '../schema'
import type { TDsbFieldKey } from '../spec'

type TRet = {
  mutation: (field: string, e: TEditValue) => Promise<void>
  mergeBackEditingTag: () => TTag[]
}

export default (): TRet => {
  const dashboard$ = useDashboard()
  const community$ = useCommunity()
  const { mutate } = useGraphQLClient()
  const { subTab } = useDsbTab()
  const isDemoMode = useDsbDemoMode()

  const storeRef = useRef(dashboard$)
  const { slug: community } = community$

  // get latest store, for those state not in UI render cycle
  useEffect(() => {
    storeRef.current = dashboard$
  }, [dashboard$])

  const _findTagIdx = (): number => {
    const { tags, editingTag } = dashboard$
    const targetIdx = findIndex((item: TTag) => item.id === editingTag.id, tags)
    return targetIdx
  }

  const mergeBackEditingTag = (): TTag[] => {
    const { editingTag, tags } = dashboard$
    const targetIdx = _findTagIdx()

    if (targetIdx < 0) return
    const updatedTags = update(targetIdx, editingTag, tags)
    if (!equals(tags, updatedTags)) {
      console.log('## not equals, update tags')
      // store.commit({ tags: updatedTags })
    }

    // store.commit({ editingTag: null })
    dashboard$.commit({ tags: updatedTags, editingTag: null })

    return updatedTags
  }

  const applyOriginal = (field: TDsbFieldKey | null): void => {
    if (!field) return

    console.log('## done field: ', field)
    let original = { ...dashboard$.original, [field]: dashboard$[field] }

    if (field === FIELD.TAG_INDEX) {
      original = { ...dashboard$.original, tags: dashboard$.tags }
    }

    if (includes(field, [FIELD.FAQ_SECTION_ADD, FIELD.FAQ_SECTION_DELETE])) {
      original = { ...dashboard$.original, faqSections: dashboard$.faqSections }
    }

    if (field === FIELD.BASE_INFO) {
      const current = {}

      for (const key of BASEINFO_KEYS) {
        current[key] = dashboard$[key]
      }
      original = { ...dashboard$.original, ...current }
    }

    if (field === FIELD.TAG) {
      const updatedTags = mergeBackEditingTag()
      original = { ...dashboard$.original, tags: updatedTags }
    }

    if (field === FIELD.SEO) {
      const current = {}

      for (const key of SEO_KEYS) {
        current[key] = dashboard$[key]
      }
      original = { ...dashboard$.original, ...current }
    }

    dashboard$.commit({ original })
  }

  const _handleDone = (fieldOverride?: TDsbFieldKey): void => {
    const field = fieldOverride ?? storeRef.current.savingField
    applyOriginal(field)
    // avoid page component jump caused by saving state
    setTimeout(() => dashboard$.commit({ saving: false, savingField: null }), 800)
  }

  /**
   * store.savingField is not works in this **Promise** staff
   * not Valtio's thing, this is hte wired React staff
   */
  const handleMutation = (schema, params, okCb = null) => {
    mutate(schema, params)
      .then((data) => {
        toast('设置已保存')
        if (okCb) okCb(data)
        _handleDone()
      })
      .catch((err) => {
        console.error('## handle request error: ', err)
        // biome-ignore lint/suspicious/noAlert: <explanation>
        alert(err)
      })
  }

  const handleDemoMutation = (field: TDsbFieldKey): void => {
    if (field === FIELD.BASE_INFO) {
      const patch = BASEINFO_KEYS.reduce((acc, key) => {
        acc[key] = dashboard$[key]
        return acc
      }, {} as Record<string, unknown>)

      community$.commit(patch)
    }

    setDsbDemoConfig(buildDsbDemoConfig(storeRef.current))
    toast('设置已保存')
    _handleDone(field)
  }

  const mutation = (field: TDsbFieldKey, e: TEditValue): Promise<void> => {
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

      handleMutation(S.updateDashboardBaseInfo, params, (data) =>
        community$.commit({ ...data.updateDashboardBaseInfo }),
      )
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
      const params = { ...editingTag, community }

      handleMutation(S.updateArticleTag, params)
      return
    }

    if (field === FIELD.TAG_INDEX) {
      const { activeTagThread, activeTagGroup: group, tags } = dashboard$
      const thread = activeTagThread.toUpperCase()

      const tagIndex = tags.map((item) => ({
        id: item.id,
        index: item.index,
      }))

      const params = { community, thread, group, tags: tagIndex }
      handleMutation(S.reindexTagsInGroup, params)
      return
    }

    // if (field === FIELD.FAQ_SECTIONS) {
    //   sr71$.mutate(S.updateDashboardFaqs, { faqs: toJS(store.faqSections), community })
    //   return
    // }

    // if (field === FIELD.FAQ_SECTION_ITEM) {
    //   const { editingFAQ, faqSections } = store
    //   const _editingFAQ = toJS(editingFAQ)
    //   const _faqSections = toJS(faqSections)
    //   const targetIndex = findIndex(
    //     (item: TFAQSection) => item.index === editingFAQ.index,
    //     _faqSections,
    //   )

    //   const updatedSections = update(targetIndex, _editingFAQ, _faqSections)
    //   store.mark({ faqSections: updatedSections, editingFAQ: null, editingFAQIndex: null })
    //   sr71$.mutate(S.updateDashboardFaqs, { faqs: updatedSections, community })
    //   return
    // }

    // if (field === FIELD.FAQ_SECTION_ADD) {
    //   const { faqSections, editingFAQ } = store
    //   const _faqSections = [...toJS(faqSections), toJS(editingFAQ)]

    //   store.mark({ faqSections: _faqSections, editingFAQ: null, editingFAQIndex: null })
    //   sr71$.mutate(S.updateDashboardFaqs, { faqs: _faqSections, community })
    //   return
    // }

    if (includes(field, values(LAYOUT_FIELD))) {
      handleMutation(S.updateDashboardLayout, { community, [field]: e })
      return
    }
  }

  return { mutation, mergeBackEditingTag }
}
