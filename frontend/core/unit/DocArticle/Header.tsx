import { useRouter } from 'next/navigation'
import { lazy, Suspense } from 'react'

import { THREAD_PATH } from '~/const/thread'
import ArrowSVG from '~/icons/Arrow'
import useArticle from '~/stores/article/hooks'

import useSalon from './salon/header'

const Share = lazy(() => import('~/unit/Share'))

export default function Header() {
  const { push } = useRouter()
  const { doc } = useArticle()
  const s = useSalon()

  if (!doc) return <h1 className={s.error}>Doc not found</h1>

  const community = doc.community?.slug || ''
  const backUrl = community ? `/${community}/${THREAD_PATH.DOC}` : `/${THREAD_PATH.DOC}`

  return (
    <header className={s.wrapper}>
      <div className={s.top}>
        <button type='button' className={s.backBtn} onClick={() => push(backUrl)}>
          <ArrowSVG className={s.backIcon} />
          <span className={s.backText}>文档</span>
        </button>
        <div className='grow' />
        <Suspense fallback={null}>
          <Share modalOffset='35%' />
        </Suspense>
      </div>

      <h1 className={s.title}>{doc.title || 'Untitled'}</h1>
      {!!doc.subtitle && <p className={s.subtitle}>{doc.subtitle}</p>}
      {!!doc.innerId && <div className={s.innerId}>#{doc.innerId}</div>}
    </header>
  )
}
