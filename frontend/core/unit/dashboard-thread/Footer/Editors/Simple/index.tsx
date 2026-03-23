import { useAutoAnimate } from '@formkit/auto-animate/react'
import { keys } from 'ramda'
import type { FC } from 'react'
import { groupByKey, sortByGroupIndex } from '~/helper'
import PlusSVG from '~/icons/Plus'
import useTrans from '~/hooks/useTrans'
import type { TLinkItem } from '~/spec'
import Button from '~/widgets/Buttons/Button'
import useFooter from '../../../logic/useFooter'
import useSalon from '../../../salon/footer/editors/simple'
import LinkEditor from '../LinkEditor'

const Simple: FC = () => {
  const s = useSalon()
  const [animateRef] = useAutoAnimate()
  const { t } = useTrans()

  const { footerLinks: links, editingLink, editingLinkMode, add2Group } = useFooter()

  const groupedLinks = groupByKey(sortByGroupIndex(links), 'group')
  const groupKeys = keys(groupedLinks) as string[]

  return (
    <div className={s.wrapper}>
      <div className={s.left} ref={animateRef}>
        <div className={s.links}>
          {groupedLinks[groupKeys[0]].map((item: TLinkItem) => (
            <div className={s.linkBlock} key={item.title}>
              <LinkEditor mode={editingLinkMode} linkItem={item} editingLink={editingLink} />
            </div>
          ))}
        </div>

        {!editingLink && (
          <Button
            size='small'
            ghost
            space={8}
            onClick={() => add2Group(groupKeys[0], groupedLinks[groupKeys[0]].length)}
            className='mt-6 w-28'
          >
            <PlusSVG className={s.icon} />
            {t('dsb.footer.editors.link')}
          </Button>
        )}
      </div>

      <ul className={s.right}>
        <h3 className={s.noteTitle}>{t('dsb.footer.editors.note.title')}</h3>
        <li className={s.noteP}>{t('dsb.footer.editors.note.item.preview')}</li>
        <li className={s.noteP}>{t('dsb.footer.editors.note.item.keep')}</li>
      </ul>
    </div>
  )
}

export default Simple
