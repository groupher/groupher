import { reject, uniq } from 'ramda'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { CHANGE_MODE } from '~/const/mode'
import { closeDrawer } from '~/signal'
import type { TChangeMode, TEditValue, TSelectOption, TTag } from '~/spec'
import useTags from '~/unit/DsbThread/logic/useTags'
import useTagsEditor from '~/unit/DsbThread/Tags/store/hooks'
import { slugify } from '~/utils/slug'
import { nilOrEmpty, validateSlug } from '~/validator'

import { DEFAULT_CREATE_TAG } from './constant'

type TArgs = {
  initialGroup?: string
  onDone?: () => void
}

type TRet = {
  mode: TChangeMode
  processing: boolean
  editingTag: TTag | null
  slugError: string
  canSubmit: boolean
  initEditingTag: (mode: TChangeMode) => void
  edit: (e: TEditValue, key: keyof TTag) => void
  onDelete: (tag: TTag) => void
  onUpdate: () => void
  onCreate: () => void
  curCategory: TSelectOption
  categoryOptions: TSelectOption[]
}

/** Exposes Tag form behavior while its draft is owned by TagsEditorStore. */
export default function useLogic({ initialGroup = '', onDone }: TArgs = {}): TRet {
  const tagsEditor = useTagsEditor()
  const { activeTagThread, createTagFromForm, deleteTag, saving, tagGroups, updateTag } = useTags()
  const editingTag = tagsEditor.tagFormDraft
  const mode = tagsEditor.tagFormMode ?? CHANGE_MODE.UPDATE
  const slugRequestId = useRef(0)
  const activeStoreRef = useRef(tagsEditor.store)
  activeStoreRef.current = tagsEditor.store

  const defaultGroup = initialGroup || tagGroups[0]?.id || ''

  const initEditingTag = useCallback(
    (nextMode: TChangeMode): void => {
      if (nextMode === CHANGE_MODE.CREATE) {
        if (tagsEditor.tagFormMode !== CHANGE_MODE.CREATE || !tagsEditor.tagFormDraft) {
          tagsEditor.store.beginTagForm(CHANGE_MODE.CREATE, {
            ...DEFAULT_CREATE_TAG,
            groupId: defaultGroup,
            thread: activeTagThread,
          } as TTag)
        } else if (!tagsEditor.tagFormDraft.groupId && defaultGroup) {
          tagsEditor.store.updateTagForm({ groupId: defaultGroup })
        }
        return
      }

      if (tagsEditor.tagFormMode === CHANGE_MODE.UPDATE && tagsEditor.tagFormDraft) {
        return
      }

      if (tagsEditor.tagFormDraft) return
      // An update drawer is opened by TagAction, which initializes the selected tag first.
    },
    [
      activeTagThread,
      defaultGroup,
      tagsEditor.tagFormDraft,
      tagsEditor.tagFormMode,
      tagsEditor.tagFormSession,
      tagsEditor.store,
    ],
  )

  const edit = (value: TEditValue, key: keyof TTag): void => {
    if (!editingTag) return
    if (key === 'slug') tagsEditor.store.markTagFormSlugEdited()
    if (key === 'title' && !tagsEditor.tagFormSlugEdited) {
      tagsEditor.store.updateTagForm({ title: value as string, slug: '' })
      return
    }

    tagsEditor.store.updateTagForm({ [key]: value } as Partial<TTag>)
  }

  useEffect(() => {
    if (!editingTag || tagsEditor.tagFormSlugEdited) return

    const title = editingTag.title?.trim()
    if (!title) {
      tagsEditor.store.updateTagForm({ slug: '' })
      return
    }

    const requestId = ++slugRequestId.current
    const session = tagsEditor.tagFormSession
    const timer = window.setTimeout(() => {
      void slugify(title)
        .then((slug) => {
          if (slugRequestId.current !== requestId) return
          if (activeStoreRef.current !== tagsEditor.store) return
          if (tagsEditor.store.tagFormSession !== session) return
          if (tagsEditor.store.tagFormDraft?.title?.trim() !== title) return
          if (tagsEditor.store.tagFormDraft.slug === slug) return
          tagsEditor.store.updateTagForm({ slug })
        })
        .catch(() => undefined)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [editingTag?.title, tagsEditor.store, tagsEditor.tagFormSession, tagsEditor.tagFormSlugEdited])

  const finishForm = (session: number, tagId?: string): void => {
    if (activeStoreRef.current !== tagsEditor.store) return
    if (tagsEditor.store.tagFormSession !== session) return
    if (tagId && tagsEditor.store.tagFormDraft?.id !== tagId) return

    tagsEditor.store.clearTagForm(session)
    closeDrawer()
    onDone?.()
  }

  const onDelete = (tag: TTag): void => {
    const session = tagsEditor.tagFormSession
    const store = tagsEditor.store
    void deleteTag(tag, session)
      .then(() => {
        if (activeStoreRef.current !== store) return
        finishForm(session, tag.id)
      })
      .catch(() => undefined)
  }

  const onUpdate = (): void => {
    if (!activeTagThread || !editingTag || !validateSlug(editingTag.slug).valid) return

    const session = tagsEditor.tagFormSession
    const store = tagsEditor.store
    void updateTag(editingTag, { source: 'form', id: session })
      .then(() => {
        if (activeStoreRef.current !== store) return
        finishForm(session, editingTag.id)
      })
      .catch(() => undefined)
  }

  const onCreate = (): void => {
    if (!activeTagThread || !editingTag || !validateSlug(editingTag.slug).valid) return

    const session = tagsEditor.tagFormSession
    const store = tagsEditor.store
    void createTagFromForm(editingTag, session)
      .then(() => {
        if (activeStoreRef.current !== store) return
        finishForm(session)
      })
      .catch(() => undefined)
  }

  const curCategory = useMemo((): TSelectOption => {
    if (!editingTag) return { label: '', value: '' }

    const group = tagGroups.find((item) => item.id === editingTag.groupId)

    return {
      label: group?.title || '',
      value: group?.id || '',
    }
  }, [editingTag, tagGroups])

  const categoryOptions = useMemo((): TSelectOption[] => {
    if (!editingTag) return []

    const existOptions = tagGroups.map((group) => ({
      label: group.title,
      value: group.id,
    }))
    const group = tagGroups.find((item) => item.id === editingTag.groupId)
    const options = group
      ? [{ label: group.title, value: group.id }, ...existOptions]
      : existOptions

    return reject((option: TSelectOption) => nilOrEmpty(option.value), uniq(options))
  }, [editingTag, tagGroups])

  const slugValidation = validateSlug(editingTag?.slug)
  const slugError =
    editingTag?.slug && !slugValidation.valid
      ? `dsb.tags.editor.slug.error.${slugValidation.reason}`
      : ''
  const canSubmit =
    !!activeTagThread &&
    !!editingTag?.title?.trim() &&
    (mode !== CHANGE_MODE.CREATE || !!editingTag?.groupId) &&
    slugValidation.valid

  return {
    mode,
    initEditingTag,
    editingTag,
    processing: saving,
    slugError,
    canSubmit,
    edit,
    onDelete,
    onUpdate,
    onCreate,
    curCategory,
    categoryOptions,
  }
}
