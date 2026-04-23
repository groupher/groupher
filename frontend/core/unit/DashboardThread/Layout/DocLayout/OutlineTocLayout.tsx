import useSalon, { cnMerge } from '../../salon/layout/doc_layout/outline_toc_layout'

export default function OutlineTocLayout() {
  const s = useSalon()

  return (
    <div className={s.block}>
      <div className={s.list}>
        <div className={s.group}>
          <div className={cnMerge(s.title, 'w-10')} />
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-20')} />
            <div className={cnMerge(s.line, 'w-40')} />
            <div className={cnMerge(s.meta, 'w-5')} />
          </div>
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-24')} />
            <div className={cnMerge(s.line, 'w-40')} />
            <div className={cnMerge(s.meta, 'w-5')} />
          </div>
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-16')} />
            <div className={cnMerge(s.line, 'w-40')} />
            <div className={cnMerge(s.meta, 'w-5')} />
          </div>
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-20')} />
            <div className={cnMerge(s.line, 'w-40')} />
            <div className={cnMerge(s.meta, 'w-5')} />
          </div>
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-24')} />
            <div className={cnMerge(s.line, 'w-40')} />
            <div className={cnMerge(s.meta, 'w-5')} />
          </div>
        </div>

        <div className={s.group}>
          <div className={cnMerge(s.title, 'w-16')} />
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-20')} />
            <div className={cnMerge(s.line, 'w-40')} />
            <div className={cnMerge(s.meta, 'w-5')} />
          </div>
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-32')} />
            <div className={cnMerge(s.line, 'w-40')} />
            <div className={cnMerge(s.meta, 'w-5')} />
          </div>
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-16')} />
            <div className={cnMerge(s.line, 'w-40')} />
            <div className={cnMerge(s.meta, 'w-5')} />
          </div>
        </div>

        <div className={s.group}>
          <div className={cnMerge(s.title, 'w-12')} />
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-20')} />
            <div className={cnMerge(s.line, 'w-40')} />
            <div className={cnMerge(s.meta, 'w-5')} />
          </div>
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-24')} />
            <div className={cnMerge(s.line, 'w-40')} />
            <div className={cnMerge(s.meta, 'w-5')} />
          </div>
        </div>
      </div>
    </div>
  )
}
