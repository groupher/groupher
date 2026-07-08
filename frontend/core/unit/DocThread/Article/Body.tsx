import { useMemo } from 'react'

import useArticle from '~/stores/article/hooks'
import RichEditorStatic from '~/unit/RichEditor/Static'

import { parseDocValue } from './helper'
import useSalon from './salon/body'

export default function Body() {
  const { doc } = useArticle()
  const s = useSalon()

  const value = useMemo(() => {
    const fallback = doc?.document?.markdown || doc?.body || doc?.digest || ''
    return parseDocValue(doc?.document?.json, fallback)
  }, [doc])

  if (!doc) return null

  return (
    <div className={s.wrapper}>
      <RichEditorStatic value={value} />
    </div>
  )
}
