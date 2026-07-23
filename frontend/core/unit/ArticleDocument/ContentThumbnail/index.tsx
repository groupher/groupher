import useSalon from './salon'
import type { TArticleThumbnail } from './spec'

type TProps = {
  thumbnail?: TArticleThumbnail | null
}

export default function ContentThumbnail({ thumbnail }: TProps) {
  const s = useSalon()

  if (!thumbnail?.blocks.length) return <div className={s.empty}>No preview available</div>

  return (
    <div className={s.wrapper} aria-hidden='true'>
      {thumbnail.blocks.map((block, index) => {
        const key = `${block.type}-${index}`

        if (block.type === 'heading') {
          return (
            <div key={key} className={s.heading}>
              {block.text}
            </div>
          )
        }

        if (block.type === 'paragraph') {
          return (
            <div key={key} className={s.paragraph}>
              {block.text}
            </div>
          )
        }

        if (block.type === 'list') {
          return (
            <div key={key} className={s.list}>
              {block.items.map((item) => (
                <div key={item} className={s.listItem}>
                  <span>•</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )
        }

        if (block.type === 'image') {
          return <img key={key} className={s.image} src={block.url} alt='' loading='lazy' />
        }

        if (block.type === 'callout') {
          return (
            <div key={key} className={s.callout}>
              {block.text}
            </div>
          )
        }

        if (block.type === 'table') {
          return (
            <div key={key} className={s.table}>
              {Array.from(
                { length: Math.min(block.rows * block.columns, 12) },
                (_, cell) => `${block.rows}x${block.columns}:${cell}`,
              ).map((cell) => (
                <span key={cell} className={s.tableCell} />
              ))}
            </div>
          )
        }

        if (block.type === 'code') {
          return (
            <pre key={key} className={s.code}>
              {block.lines.join('\n')}
            </pre>
          )
        }

        return null
      })}
    </div>
  )
}
