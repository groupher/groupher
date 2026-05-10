import MarkdownRender from 'markdown-to-jsx/react'
import type { ReactNode } from 'react'

import type { TSpace } from '~/spec'

import useSalon from './salon'

type TProps = {
  children: ReactNode
  className?: string
} & TSpace

export default function Markdown({ children, className = '', ...spacing }: TProps) {
  const s = useSalon({ className, ...spacing })

  return (
    <div className={s.wrapper}>
      {/* @ts-ignore*/}
      <MarkdownRender
        options={{
          overrides: {
            p: { props: { className: s.paragraph } },
            ul: { props: { className: s.list } },
            ol: { props: { className: s.list } },
            li: { props: { className: s.listItem } },
            h1: { props: { className: s.heading } },
            h2: { props: { className: s.heading } },
            h3: { props: { className: s.heading } },
            h4: { props: { className: s.heading } },
            h5: { props: { className: s.heading } },
            h6: { props: { className: s.heading } },
            strong: { props: { className: s.strong } },
            a: { props: { className: s.link } },
            code: { props: { className: s.inlineCode } },
            pre: { props: { className: s.codeBlock } },
            em: { props: { className: s.emphasis } },
            blockquote: { props: { className: s.quote } },
          },
        }}
      >
        {children}
      </MarkdownRender>
    </div>
  )
}
