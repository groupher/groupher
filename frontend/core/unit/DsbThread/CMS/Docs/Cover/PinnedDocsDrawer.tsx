import { useMemo, useState } from 'react'

import CheckSVG from '~/icons/Check'
import Input from '~/ui/Input'

import type { TCoverDocOption } from './useLogic'

type TProps = {
  docs: readonly TCoverDocOption[]
  busyNodeId?: string | null
  onToggle: (doc: TCoverDocOption) => void
}

export default function PinnedDocsDrawer({ docs, busyNodeId, onToggle }: TProps) {
  const [query, setQuery] = useState('')
  const visibleDocs = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return docs
    return docs.filter((doc) => doc.title.toLocaleLowerCase().includes(normalized))
  }, [docs, query])

  return (
    <div className='column gap-5 p-8'>
      <div className='column gap-1'>
        <h2 className='m-0 text-xl font-semibold'>Pin docs to cover</h2>
        <p className='text-digest m-0 text-sm'>
          Published docs without pending changes can be pinned.
        </p>
      </div>
      <Input
        value={query}
        placeholder='Search all documents...'
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className='column gap-2'>
        {visibleDocs.map((doc) => {
          const disabled = (!doc.pinned && doc.disabled) || busyNodeId === doc.nodeId

          return (
            <button
              key={doc.nodeId}
              type='button'
              disabled={disabled}
              className='row-center hover:bg-hoverBg min-h-14 gap-3 rounded-lg px-3 text-left disabled:cursor-not-allowed disabled:opacity-50'
              onClick={() => onToggle(doc)}
            >
              <span className='align-both border-divider size-5 shrink-0 rounded-full border'>
                {doc.pinned && <CheckSVG className='size-3' />}
              </span>
              <span className='column min-w-0 grow'>
                <span className='truncate text-sm font-medium'>{doc.title}</span>
                <span className='text-digest truncate text-xs'>{doc.path}</span>
              </span>
              {doc.disabled && !doc.pinned && (
                <span className='column items-end gap-1'>
                  <span className='bg-alphaBg rounded px-2 py-0.5 text-xs'>Draft</span>
                  <span className='text-digest text-xs'>{doc.reason}</span>
                </span>
              )}
              {doc.pinned && <span className='text-digest text-xs'>Pinned</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
