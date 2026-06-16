import type { FC } from 'react'

import type { TSideTreeController } from '../SideTree/useSideTree'
import Body from './Body'
import Cover from './Cover'
import Footer from './Footer'
import useSalon from './salon'
import Title from './Title'
import useDocDraftEditor from './useDocDraftEditor'

type TProps = {
  sideTree: TSideTreeController
}

const Article: FC<TProps> = ({ sideTree }) => {
  const s = useSalon()
  const {
    activePage,
    bodyValue,
    dirty,
    editable,
    error,
    invalid,
    loading,
    saving,
    save,
    setBodyValue,
    setTitle,
    slug,
    title,
  } = useDocDraftEditor(sideTree)

  if (!activePage) {
    return (
      <article className={s.wrapper}>
        <div className={s.empty}>选择一个文档页面开始编辑</div>
      </article>
    )
  }

  if (!editable) {
    return (
      <article className={s.wrapper}>
        <div className={s.empty}>当前页面缺少 docId</div>
      </article>
    )
  }

  return (
    <article className={s.wrapper}>
      <Cover />
      <Title value={title} disabled={loading || saving} onChange={setTitle} />
      <Body
        value={bodyValue}
        editorKey={activePage.docId}
        disabled={loading}
        onChange={setBodyValue}
      />
      <div className={s.saveBar}>
        <button
          type='button'
          className={s.saveButton}
          disabled={loading || saving || invalid || !dirty}
          onClick={save}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {slug && <span className={s.slug}>/{slug}</span>}
        {error && <span className={s.error}>{error}</span>}
      </div>
      <Footer />
    </article>
  )
}

export default Article
