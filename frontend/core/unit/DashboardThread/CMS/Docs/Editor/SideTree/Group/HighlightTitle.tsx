import type { FC } from 'react'
import Highlighter from 'react-highlight-words'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  className: string
  query: string
  text: string
}

const HighlightTitle: FC<TProps> = ({ className, query, text }) => {
  const { cn, primary } = useTwBelt()
  const trimmedQuery = query.trim()
  const highlightClassName = cn('rounded px-0.5 text-inherit', primary('bgSoft'))

  if (!trimmedQuery) return <span className={className}>{text}</span>

  return (
    <Highlighter
      autoEscape
      className={className}
      highlightClassName={highlightClassName}
      highlightTag='span'
      searchWords={[trimmedQuery]}
      textToHighlight={text}
      unhighlightTag='span'
    />
  )
}

export default HighlightTitle
