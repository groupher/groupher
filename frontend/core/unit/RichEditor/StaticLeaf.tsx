import { SlateLeaf, type SlateLeafProps } from 'platejs'

import useSalon, { cn } from './salon/static'

type TLeaf = SlateLeafProps['leaf'] & {
  bold?: boolean
  code?: boolean
  highlight?: boolean
  italic?: boolean
  kbd?: boolean
  strikethrough?: boolean
  subscript?: boolean
  superscript?: boolean
  underline?: boolean
}

export default function StaticLeaf(props: SlateLeafProps) {
  const s = useSalon()
  const leaf = props.leaf as TLeaf
  const as = leaf.subscript ? 'sub' : leaf.superscript ? 'sup' : 'span'

  return (
    <SlateLeaf
      {...props}
      as={as}
      className={cn(
        leaf.bold && 'font-bold',
        leaf.italic && 'italic',
        leaf.underline && 'underline underline-offset-4',
        leaf.strikethrough && 'line-through',
        leaf.code && s.inlineCode,
        leaf.kbd && s.kbd,
        leaf.highlight && s.highlight,
      )}
    />
  )
}
