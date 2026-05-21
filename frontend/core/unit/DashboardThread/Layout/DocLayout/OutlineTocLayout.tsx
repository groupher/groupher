import useSalon, { cnMerge } from './salon/outline_toc_layout'

export default function OutlineTocLayout() {
  const s = useSalon()

  return (
    <div className={s.block}>
      <div className={s.list}>
        <div className={s.group}>
          <div className={cnMerge(s.title, 'w-1/6')} />
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-1/3')} />
            <div className={cnMerge(s.line, 'w-3/5')} />
            <div className={cnMerge(s.meta, 'w-1/12')} />
          </div>
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-2/5')} />
            <div className={cnMerge(s.line, 'w-1/2')} />
            <div className={cnMerge(s.meta, 'w-1/12')} />
          </div>
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-1/4')} />
            <div className={cnMerge(s.line, 'w-3/5')} />
            <div className={cnMerge(s.meta, 'w-1/12')} />
          </div>
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-1/3')} />
            <div className={cnMerge(s.line, 'w-3/5')} />
            <div className={cnMerge(s.meta, 'w-1/12')} />
          </div>
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-2/5')} />
            <div className={cnMerge(s.line, 'w-1/2')} />
            <div className={cnMerge(s.meta, 'w-1/12')} />
          </div>
        </div>

        <div className={s.group}>
          <div className={cnMerge(s.title, 'w-1/4')} />
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-1/3')} />
            <div className={cnMerge(s.line, 'w-3/5')} />
            <div className={cnMerge(s.meta, 'w-1/12')} />
          </div>
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-1/2')} />
            <div className={cnMerge(s.line, 'w-2/5')} />
            <div className={cnMerge(s.meta, 'w-1/12')} />
          </div>
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-1/4')} />
            <div className={cnMerge(s.line, 'w-3/5')} />
            <div className={cnMerge(s.meta, 'w-1/12')} />
          </div>
        </div>

        <div className={s.group}>
          <div className={cnMerge(s.title, 'w-1/5')} />
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-1/3')} />
            <div className={cnMerge(s.line, 'w-3/5')} />
            <div className={cnMerge(s.meta, 'w-1/12')} />
          </div>
          <div className={s.row}>
            <div className={cnMerge(s.articleTitle, 'w-2/5')} />
            <div className={cnMerge(s.line, 'w-1/2')} />
            <div className={cnMerge(s.meta, 'w-1/12')} />
          </div>
        </div>
      </div>
    </div>
  )
}
