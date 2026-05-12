import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import PlusSVG from '~/icons/Plus'
import useDashboard from '~/stores/dashboard/hooks'
import { FIELD } from '~/unit/DashboardThread/constant'
import Button from '~/widgets/Buttons/Button'

import LinkEditor from '../../../LinkEditor'
import useFooter from '../../../logic/useFooter'
import useSalon from '../../../salon/footer/editors/simple'
import FooterDndContext from '../FooterDndContext'
import FooterSortableGroup from '../FooterSortableGroup'
import { toDraftLink } from '../model'
import SortableFooterLinkItem from '../SortableFooterLinkItem'
import useFooterEditorActions from '../useFooterEditorActions'

const Simple: FC = () => {
  const s = useSalon()
  const { t } = useTrans()
  const dsb$ = useDashboard()

  const { footerLinks: links } = useFooter()
  const editor = useFooterEditorActions(links)

  return (
    <div className={s.wrapper}>
      <FooterDndContext
        links={links}
        onCommit={(nextLinks) => dsb$.editField(FIELD.FOOTER_LINKS, nextLinks)}
      >
        {({ columns }) => {
          const column = columns[0]

          return (
            <div className={s.left}>
              {column && (
                <FooterSortableGroup
                  className={s.links}
                  overClassName={s.linksOver}
                  columnId={column.id}
                  ids={column.links.map((item) => item.dndId)}
                >
                  {column.links.map((item, index) => {
                    const linkItem = toDraftLink(item, column.id, 0, index)

                    return (
                      <SortableFooterLinkItem
                        key={item.dndId}
                        id={item.dndId}
                        columnId={column.id}
                        editing={
                          linkItem.group === editor.editingLink?.group &&
                          linkItem.index === editor.editingLink?.index
                        }
                      >
                        <div className={s.linkBlock}>
                          <LinkEditor
                            mode={editor.editingLinkMode}
                            linkItem={linkItem}
                            editingLink={editor.editingLink}
                            actions={editor.linkActions}
                          />
                        </div>
                      </SortableFooterLinkItem>
                    )
                  })}
                </FooterSortableGroup>
              )}

              {!editor.editingLink && (
                <Button
                  size='small'
                  ghost
                  noBorder
                  space={8}
                  onClick={() =>
                    column ? editor.add2Group(column.id, 0) : editor.add2NewGroup('Links', 0)
                  }
                  className='mt-6 w-28'
                >
                  <PlusSVG className={s.icon} />
                  {t('dsb.footer.editors.link')}
                </Button>
              )}
            </div>
          )
        }}
      </FooterDndContext>

      <ul className={s.right}>
        <h3 className={s.noteTitle}>{t('dsb.footer.editors.note.title')}</h3>
        <li className={s.noteP}>{t('dsb.footer.editors.note.item.preview')}</li>
        <li className={s.noteP}>{t('dsb.footer.editors.note.item.keep')}</li>
      </ul>
    </div>
  )
}

export default Simple
