import type { FC } from 'react'

import { safeLink } from './previewModel'
import useSalon from './salon'
import type { Node } from './types'

const Navigation: FC<{ nodes: Node[]; onSelect: (id: string) => void; parent?: string | null }> = ({
  nodes,
  onSelect,
  parent = null,
}) => {
  const s = useSalon()
  return (
    <ul className={s.tree}>
      {nodes
        .filter((node) => node.parent_node_id === parent && !node.hidden)
        .sort((a, b) => a.index - b.index || a.node_id.localeCompare(b.node_id))
        .map((node) => (
          <li key={node.node_id}>
            {node.doc_id ? (
              <button className={s.button} type='button' onClick={() => onSelect(node.doc_id!)}>
                {node.title}
              </button>
            ) : safeLink(node.href) ? (
              <a href={safeLink(node.href)} target='_blank' rel='noreferrer'>
                {node.title}
              </a>
            ) : (
              <span>{node.title}</span>
            )}
            <Navigation nodes={nodes} onSelect={onSelect} parent={node.node_id} />
          </li>
        ))}
    </ul>
  )
}
export default Navigation
