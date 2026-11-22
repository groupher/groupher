import type { FC } from 'react'

import Markdown from '~/render/Markdown'

import useSalon from './salon'

type FAQ = {
  title?: string
  desc?: string
  grouped_view?: boolean
  group_items?: {
    id: string
    title: string
    items: { id: string; title: string; detail: string }[]
  }[]
  flat_items?: { id: string; title: string; detail: string }[]
}
const PreviewFAQ: FC<{ value: FAQ | undefined }> = ({ value }) => {
  const s = useSalon()
  if (!value) return null
  const groups = value.grouped_view
    ? (value.group_items ?? [])
    : [{ id: 'flat', title: '', items: value.flat_items ?? [] }]
  return (
    <section className={s.panel}>
      <h2>{value.title}</h2>
      <p>{value.desc}</p>
      {groups.map((group) => (
        <section key={group.id}>
          <h3>{group.title}</h3>
          {group.items.map((item) => (
            <details key={item.id}>
              <summary>{item.title}</summary>
              <Markdown>{item.detail}</Markdown>
            </details>
          ))}
        </section>
      ))}
    </section>
  )
}
export default PreviewFAQ
