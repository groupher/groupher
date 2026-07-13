import { useEffect, useEffectEvent } from 'react'

import { EDITABLE_KEY_TARGET_TAGS, IMAGE_DELETE_KEYS } from './constant'
import { useImageDraftContext } from './imageDraftContext'
import type { TCoverImageWhich } from './spec'

type TProps = {
  enabled: boolean
  onDelete: (which: TCoverImageWhich) => void
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false

  const tagName = target.tagName.toLowerCase()

  return target.isContentEditable || EDITABLE_KEY_TARGET_TAGS.some((tag) => tag === tagName)
}

export default function KeyboardDeleteHandler({ enabled, onDelete }: TProps) {
  const { activeImage, activeImageWhich, clearImageDraft } = useImageDraftContext()

  const handleKeyDown = useEffectEvent((event: KeyboardEvent): void => {
    if (!enabled || !activeImage) return
    if (!IMAGE_DELETE_KEYS.some((key) => key === event.key)) return
    if (event.repeat) return
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (isEditableTarget(event.target)) return

    event.preventDefault()
    event.stopPropagation()
    clearImageDraft()
    onDelete(activeImageWhich)
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      handleKeyDown(event)
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  return null
}
