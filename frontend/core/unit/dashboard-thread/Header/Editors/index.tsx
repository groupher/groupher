/* eslint-disable react/no-unescaped-entities */

import { useAutoAnimate } from '@formkit/auto-animate/react'
import { filter, keys, length, startsWith } from 'ramda'
import type { FC } from 'react'
import { MORE_GROUP, ONE_LINK_GROUP } from '~/const/dashboard'
import { groupByKey, sortByGroupIndex } from '~/helper'
import useTrans from '~/hooks/useTrans'
import PlusSVG from '~/icons/Plus'
import type { TLinkItem } from '~/spec'
import Button from '~/widgets/Buttons/Button'
import GroupInputer from '../../Footer/Editors/GroupInputer'
import LinkEditor from '../../Footer/Editors/LinkEditor'
import useHeader from '../../logic/useHeader'
import useSalon from '../../salon/header/editors'
import FixedLinks from './FixedLinks'
import GroupHead from './GroupHead'

const Editor: FC = () => {
  const s = useSalon()
  const { t } = useTrans()

  const [animateRef] = useAutoAnimate()
  const [groupAnimateRef] = useAutoAnimate()

  const {
    headerLinks: links,
    editingLink,
    editingLinkMode,
    editingGroup,
    editingGroupIndex,
    deleteGroup,
    moveGroup2Left,
    moveGroup2Right,
    moveGroup2EdgeLeft,
    moveGroup2EdgeRight,
    add2Group,
    addHeaderLinkGroup,
    triggerGroupAdd,
    updateEditingGroup,
    confirmGroupAdd,
    cancelGroupChange,
  } = useHeader()

  const isAboutLinkFold =
    length(filter((item) => item.title !== '' && item.group !== MORE_GROUP, links)) >= 1

  const groupedLinks = groupByKey(sortByGroupIndex(links), 'group')
  const groupKeys = keys(groupedLinks) as string[]

  return (
    <div className={s.wrapper}>
      <div className={s.topWrapper}>
        <div className={s.leftPart}>
          <FixedLinks isAboutLinkFold={isAboutLinkFold} />
        </div>
        <ul className={s.rightPart}>
          <h3 className={s.noteTitle}>{t('dsb.header.editors.note.title')}</h3>
          <li className={s.noteP}>{t('dsb.header.editors.note.item.fixed')}</li>
          <li className={s.noteP}>{t('dsb.header.editors.note.item.about')}</li>
          <li className={s.noteP}>{t('dsb.header.editors.note.item.preview')}</li>
        </ul>
      </div>

      <div className={s.divider} />

      {editingGroup !== null &&
      !startsWith(ONE_LINK_GROUP, editingGroup) &&
      editingGroupIndex === null ? (
        <div className={s.groupInputer}>
          <GroupInputer
            value={editingGroup}
            onChange={updateEditingGroup}
            onConfirm={confirmGroupAdd}
            onCancel={cancelGroupChange}
          />
        </div>
      ) : (
        <div className={s.adder}>
          <Button size='small' onClick={addHeaderLinkGroup} space={8} ghost>
            <PlusSVG className={s.plusIcon} />
            {t('dsb.header.editors.link')}
          </Button>
          <div className={s.slash}>/</div>
          <Button size='small' onClick={triggerGroupAdd} space={10} ghost>
            <PlusSVG className={s.plusIcon} />
            {t('dsb.header.editors.group')}
          </Button>
        </div>
      )}

      <div className={s.linkGroup} ref={groupAnimateRef}>
        {groupKeys.map((groupKey: string, index) => {
          const curGroupLinks = groupedLinks[groupKey]

          if (
            // isAboutLinkFold
            links.length === 2 &&
            links[0].title === '' &&
            curGroupLinks[0].group === MORE_GROUP
          ) {
            return null
          }

          return (
            <div className={s.columnWrapper} key={groupKey}>
              <div className={s.itemsWrapper} ref={animateRef}>
                <GroupHead
                  title={groupKey as string}
                  curGroupIndex={index}
                  moveLeft={() => moveGroup2Left(groupKey)}
                  moveRight={() => moveGroup2Right(groupKey)}
                  moveEdgeLeft={() => moveGroup2EdgeLeft(groupKey)}
                  moveEdgeRight={() => moveGroup2EdgeRight(groupKey)}
                  isEdgeLeft={index === 0}
                  isEdgeRight={index === groupKeys.length - 2}
                  onDelete={() => deleteGroup(curGroupLinks[0].groupIndex)}
                />
                {curGroupLinks.map((item, index) => {
                  const isAboutLink =
                    item.group === MORE_GROUP && index === curGroupLinks.length - 1

                  return (
                    <LinkEditor
                      // must use item.title as key, or the sort animation will fail, wired
                      key={item.title}
                      mode={editingLinkMode}
                      linkItem={item as TLinkItem}
                      editingLink={editingLink}
                      isFirst={index === 0}
                      isLast={index === curGroupLinks.length - 1}
                      disableEdit={isAboutLink}
                      disableSetting={isAboutLink}
                    />
                  )
                })}
              </div>

              {!editingLink && !startsWith(ONE_LINK_GROUP, groupKey) && (
                <div className={s.adder}>
                  <Button
                    size='small'
                    ghost
                    space={8}
                    onClick={() => add2Group(groupKey, curGroupLinks.length)}
                  >
                    <PlusSVG className={s.plusIcon} />
                    {t('dsb.header.editors.link')}
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Editor
