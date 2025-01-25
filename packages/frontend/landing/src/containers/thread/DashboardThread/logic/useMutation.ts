import { useEffect, useRef } from 'react'
import { includes, omit, values, update, findIndex, equals, keys, filter } from 'ramda'

import type { TEditValue, TTag } from '~/spec'
import { DASHBOARD_BASEINFO_ROUTE } from '~/const/route'
import { toast } from '~/signal'

import { mutate } from '~/server'
import useSubStore from '~/hooks/useSubStore'
import useViewing from '~/hooks/useViewing'

import type { TSettingField } from '~/stores/dashboard/spec'

import {
  SETTING_FIELD,
  BASEINFO_BASIC_KEYS,
  BASEINFO_OTHER_KEYS,
  SETTING_LAYOUT_FIELD,
  SEO_KEYS,
  BASEINFO_KEYS,
} from '~/stores/dashboard/constant'
import S from '../schema'

type TRet = {
  mutation: (field: string, e: TEditValue) => Promise<void>
  mergeBackEditingTag: () => TTag[]
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { updateViewingCommunity, community: curCommunity } = useViewing()
  const community = curCommunity.slug
  const storeRef = useRef(store)

  // get latest store, for those state not in UI render cycle
  useEffect(() => {
    storeRef.current = store
  }, [store])

  const _findTagIdx = (): number => {
    const { tags, editingTag } = store
    const targetIdx = findIndex((item: TTag) => item.id === editingTag.id, tags)
    return targetIdx
  }

  const mergeBackEditingTag = (): TTag[] => {
    const { editingTag, tags } = store
    const targetIdx = _findTagIdx()

    if (targetIdx < 0) return
    const updatedTags = update(targetIdx, editingTag, tags)
    if (!equals(tags, updatedTags)) {
      console.log('## not equals, update tags')
      // store.commit({ tags: updatedTags })
    }

    // store.commit({ editingTag: null })
    store.commit({ tags: updatedTags, editingTag: null })

    return updatedTags
  }

  const _handleDone = () => {
    const field = storeRef.current.savingField
    console.log('## done field: ', field)
    let original = { ...store.original, [field]: store[field] }

    if (field === SETTING_FIELD.TAG_INDEX) {
      original = { ...store.original, tags: store.tags }
    }

    if (includes(field, [SETTING_FIELD.FAQ_SECTION_ADD, SETTING_FIELD.FAQ_SECTION_DELETE])) {
      original = { ...store.original, faqSections: store.faqSections }
    }

    if (field === SETTING_FIELD.BASE_INFO) {
      const current = {}

      for (const key of BASEINFO_KEYS) {
        current[key] = store[key]
      }
      original = { ...store.original, ...current }
    }

    if (field === SETTING_FIELD.TAG) {
      const updatedTags = mergeBackEditingTag()
      original = { ...store.original, tags: updatedTags }
    }

    if (field === SETTING_FIELD.SEO) {
      const current = {}

      for (const key of SEO_KEYS) {
        current[key] = store[key]
      }
      original = { ...store.original, ...current }
    }

    store.commit({ original })

    // avoid page component jump caused by saving state
    setTimeout(() => store.commit({ saving: false, savingField: null }), 800)
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
        alert(err)
      })
  }

  const mutation = (field: TSettingField, e: TEditValue): Promise<void> => {
    if (field === SETTING_FIELD.ENABLE) {
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

    if (field === SETTING_FIELD.BROADCAST_ENABLE) {
      const params = {
        community,
        broadcastEnable: storeRef.current.broadcastEnable,
      }
      handleMutation(S.updateDashboardLayout, params)
      return
    }

    if (field === SETTING_FIELD.MEDIA_REPORTS) {
      const { mediaReports } = store

      const params = {
        community,
        mediaReports: mediaReports.map((item) => omit(['editUrl'], item)),
      }

      handleMutation(S.updateDashboardMediaReports, params)
      return
    }

    if (field === SETTING_FIELD.HEADER_LINKS) {
      const { headerLinks } = storeRef.current

      handleMutation(S.updateDashboardHeaderLinks, { community, headerLinks })
      return
    }

    if (field === SETTING_FIELD.FOOTER_LINKS) {
      const { footerLinks } = store
      handleMutation(S.updateDashboardFooterLinks, { community, footerLinks })
      return
    }

    if (field === SETTING_FIELD.BASE_INFO) {
      const { baseInfoTab } = store

      const params = { community }
      if (baseInfoTab === DASHBOARD_BASEINFO_ROUTE.BASIC) {
        for (const key of BASEINFO_BASIC_KEYS) {
          params[key] = store[key]
        }
      }

      if (baseInfoTab === DASHBOARD_BASEINFO_ROUTE.OTHER) {
        for (const key of BASEINFO_OTHER_KEYS) {
          params[key] = store[key]
        }
      }

      handleMutation(S.updateDashboardBaseInfo, params, (data) =>
        updateViewingCommunity(data.updateDashboardBaseInfo),
      )
      return
    }

    if (field === SETTING_FIELD.SOCIAL_LINKS) {
      const { socialLinks } = store
      const params = { community, socialLinks }

      handleMutation(S.updateDashboardSocialLinks, params)
      return
    }

    // if (field === SETTING_FIELD.SEO) {
    //   const params = {}
    //   const { seoTab } = store

    //   if (seoTab === DASHBOARD_SEO_ROUTE.SEARCH_ENGINE) {
    //     forEach((key) => {
    //       params[key] = store[key]
    //     }, SEO_OG_KEYS)
    //   }

    //   if (seoTab === DASHBOARD_SEO_ROUTE.TWITTER) {
    //     forEach((key) => {
    //       params[key] = store[key]
    //     }, SEO_TW_KEYS)
    //   }

    //   sr71$.mutate(S.updateDashboardSeo, { community, ...params })
    //   return
    // }

    if (field === SETTING_FIELD.NAME_ALIAS) {
      const { nameAlias } = storeRef.current
      const params = { community, nameAlias }

      handleMutation(S.updateDashboardNameAlias, params)
      return
    }

    if (field === SETTING_FIELD.TAG) {
      const { editingTag } = storeRef.current
      const params = { ...editingTag, community }

      handleMutation(S.updateArticleTag, params)
      return
    }

    if (field === SETTING_FIELD.TAG_INDEX) {
      const { activeTagThread, activeTagGroup: group, tags } = store
      const thread = activeTagThread.toUpperCase()

      const tagIndex = tags.map((item) => ({
        id: item.id,
        index: item.index,
      }))

      const params = { community, thread, group, tags: tagIndex }
      handleMutation(S.reindexTagsInGroup, params)
      return
    }

    // if (field === SETTING_FIELD.FAQ_SECTIONS) {
    //   sr71$.mutate(S.updateDashboardFaqs, { faqs: toJS(store.faqSections), community })
    //   return
    // }

    // if (field === SETTING_FIELD.FAQ_SECTION_ITEM) {
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

    // if (field === SETTING_FIELD.FAQ_SECTION_ADD) {
    //   const { faqSections, editingFAQ } = store
    //   const _faqSections = [...toJS(faqSections), toJS(editingFAQ)]

    //   store.mark({ faqSections: _faqSections, editingFAQ: null, editingFAQIndex: null })
    //   sr71$.mutate(S.updateDashboardFaqs, { faqs: _faqSections, community })
    //   return
    // }

    if (includes(field, values(SETTING_LAYOUT_FIELD))) {
      handleMutation(S.updateDashboardLayout, { community, [field]: e })
      return
    }
  }

  return { mutation, mergeBackEditingTag }
}
