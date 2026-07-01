declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

declare module 'react-highlight-words' {
  import type { ComponentType, CSSProperties, ReactNode } from 'react'

  type THighlighterProps = {
    activeClassName?: string
    activeIndex?: number
    activeStyle?: CSSProperties
    autoEscape?: boolean
    caseSensitive?: boolean
    className?: string
    highlightClassName?: string | Record<string, string>
    highlightStyle?: CSSProperties
    highlightTag?: ComponentType<{ children: ReactNode; className?: string }> | string
    sanitize?: (text: string) => string
    searchWords: Array<string | RegExp>
    textToHighlight: string
    unhighlightClassName?: string
    unhighlightStyle?: CSSProperties
    unhighlightTag?: ComponentType<{ children: ReactNode; className?: string }> | string
  }

  const Highlighter: ComponentType<THighlighterProps>
  export default Highlighter
}
