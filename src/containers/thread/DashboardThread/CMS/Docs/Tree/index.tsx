import { type FC, useEffect, useRef } from 'react'
import { type CursorProps, type NodeApi, type NodeRendererProps, Tree } from 'react-arborist'

import type { TPagedArticles } from '~/spec'

import DragSVG from '~/icons/Dragble'
import ArrowSVG from '~/icons/ArrowSimple'
import DeleteSVG from '~/icons/Trash'
import EditSVG from '~/icons/EditPen'

import { treeData, type TTreeItem } from '../treeData'

import Actions from './Actions'
import Note from './Note'

import useSalon, { cn } from '../../../salon/cms/docs/tree'

type TProps = {
  pagedDocs: TPagedArticles
}

// see example: https://codesandbox.io/s/react-arborist-epopl1?file=/src/components/Tree/index.ts

const TreeView: FC<TProps> = ({ pagedDocs }) => {
  const s = useSalon()
  const treeRef = useRef()
  console.log('## pagedDocs: ', pagedDocs)

  useEffect(() => {
    // const tree = treeRef.current
    /* See the Tree API reference for all you can do with it. */
  }, [])

  return (
    <div
      className={s.wrapper}
      onClick={() => {
        // treeRef.current.createLeaf()
        // treeRef.current.createInternal()
        // console.log('## ## tree: ', treeRef.current)
        // console.log('## ## get Data: ', treeRef.current)
        // treeRef.current.unselectAll()
      }}
    >
      <Tree
        ref={treeRef}
        // data={treeData}
        initialData={treeData}
        width={175}
        height={1000}
        rowHeight={35}
        indent={14}
        renderCursor={Cursor}
        paddingBottom={32}
        // disableEdit={(data) => data.readOnly}
        disableDrop={({ parentNode, dragNodes }) => {
          if (
            parentNode.data.name === 'Categories' &&
            dragNodes.some((drag) => drag.data.name === 'Inbox')
          ) {
            return true
          }
          return false
        }}
      >
        {Node}
      </Tree>
      <div className={s.content}>
        <Actions />
        <Note />
      </div>
    </div>
  )
}

function Node({ node, style, dragHandle }: NodeRendererProps<TTreeItem>) {
  const s = useSalon()
  // const Icon = node.data?.icon || <span>O</span>
  const hasChild = node.isInternal && !!node.data.children

  return (
    <div
      className={cn(s.folderWrapper, hasChild && 'bold-sm')}
      ref={dragHandle}
      style={style}
      onClick={() => node.isInternal && node.toggle()}
    >
      <DragSVG className={s.dragIcon} />
      <div
        className={cn(s.folderName, !!node.data.children || (node.isSelected && 'bold leading-8'))}
      >
        {node.isEditing ? <Input node={node} /> : node.data.name}
        <FolderArrow node={node} />
      </div>

      <div className={s.actionWrapper}>
        <EditSVG className={s.editIcon} />
        <DeleteSVG className={s.deleteIcon} />
      </div>
      {/* <span>{node.data.unread === 0 ? null : node.data.unread}</span> */}
    </div>
  )
}

function FolderArrow({ node }: { node: NodeApi<TTreeItem> }) {
  const s = useSalon()

  if (node.isLeaf) return <span />

  return (
    <>
      {node.isOpen ? (
        <ArrowSVG className={s.arrowUpIcon} />
      ) : (
        <ArrowSVG className={s.arrowDownIcon} />
      )}
    </>
  )
}

function Input({ node }: { node: NodeApi<TTreeItem> }) {
  return (
    <input
      type="text"
      defaultValue={node.data.name}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => node.reset()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') node.reset()
        if (e.key === 'Enter') node.submit(e.currentTarget.value)
      }}
    />
  )
}

const Cursor: FC<CursorProps> = ({ top, left }) => {
  const s = useSalon()
  // @ts-ignore
  return (
    <div
      className={s.customCursor}
      style={{
        top,
        left,
      }}
    />
  )
}

export default TreeView
