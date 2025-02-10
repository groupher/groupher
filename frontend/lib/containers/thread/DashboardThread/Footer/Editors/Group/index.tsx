import type { FC } from 'react'
import { keys } from 'ramda'

import { useAutoAnimate } from '@formkit/auto-animate/react'

import type { TLinkItem } from '~/spec'

import PlusSVG from '~/icons/Plus'
import Button from '~/widgets/Buttons/Button'

import { sortByIndex, groupByKey } from '~/helper'

import LinkEditor from '../LinkEditor'
import GroupInputer from '../GroupInputer'

import GroupHead from './GroupHead'

import useFooter from '../../../logic/useFooter'
import useSalon from '../../../salon/footer/editors/group'

const Group: FC = () => {
  const s = useSalon()

  const {
    footerLinks: links,
    editingLink,
    editingLinkMode,
    editingGroup,
    editingGroupIndex,
    add2Group,
    deleteGroup,
    moveGroup2Left,
    moveGroup2Right,
    moveGroup2EdgeLeft,
    moveGroup2EdgeRight,
    updateEditingGroup,
    triggerGroupAdd,
    cancelGroupChange,
    confirmGroupAdd,
  } = useFooter()

  const [animateRef] = useAutoAnimate()
  const [groupAnimateRef] = useAutoAnimate()

  // @ts-ignore
  const groupedLinks = groupByKey(sortByIndex(links, 'groupIndex'), 'group')
  const groupKeys = keys(groupedLinks)

  return (
    <div className={s.wrapper}>
      <div className={s.actionRow}>
        {editingGroup !== null && editingGroupIndex === null ? (
          <GroupInputer
            value={editingGroup}
            onChange={updateEditingGroup}
            onConfirm={confirmGroupAdd}
            onCancel={cancelGroupChange}
          />
        ) : (
          <Button size="small" className="w-40" ghost space={4} onClick={() => triggerGroupAdd()}>
            <PlusSVG className={s.plusIcon} />
            添加分组
          </Button>
        )}
      </div>
      <div className={s.linkGroup} ref={groupAnimateRef}>
        {groupKeys.map((groupKey: string, index) => {
          const curGroupLinks = groupedLinks[groupKey]

          return (
            <div className={s.column} key={groupKey}>
              <div className={s.items} ref={animateRef}>
                <GroupHead
                  title={groupKey as string}
                  editingGroup={editingGroup}
                  editingGroupIndex={editingGroupIndex}
                  curGroupIndex={index}
                  moveLeft={() => moveGroup2Left(groupKey)}
                  moveRight={() => moveGroup2Right(groupKey)}
                  moveEdgeLeft={() => moveGroup2EdgeLeft(groupKey)}
                  moveEdgeRight={() => moveGroup2EdgeRight(groupKey)}
                  isEdgeLeft={index === 0}
                  isEdgeRight={index === groupKeys.length - 1}
                  onDelete={() => deleteGroup(curGroupLinks[0].groupIndex)}
                />
                {curGroupLinks.map((item, index) => (
                  <LinkEditor
                    // must use item.title as key, or the sort animation will fail, wired
                    key={item.title}
                    mode={editingLinkMode}
                    linkItem={item as TLinkItem}
                    editingLink={editingLink}
                    isFirst={index === 0}
                    isLast={index === curGroupLinks.length - 1}
                  />
                ))}
              </div>

              {!editingLink && (
                <Button
                  size="small"
                  ghost
                  space={4}
                  onClick={() => add2Group(groupKey, curGroupLinks.length)}
                  className="w-24"
                >
                  <PlusSVG className={s.plusIcon} />
                  链接
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Group
