import { useAutoAnimate } from '@formkit/auto-animate/react'
import { keys } from 'ramda'
import type { FC } from 'react'
import { groupByKey, sortByGroupIndex } from '~/helper'
import PlusSVG from '~/icons/Plus'
import type { TLinkItem } from '~/spec'
import Button from '~/widgets/Buttons/Button'
import useFooter from '../../../logic/useFooter'
import useSalon from '../../../salon/footer/editors/simple'
import LinkEditor from '../LinkEditor'

const Simple: FC = () => {
  const s = useSalon()
  const [animateRef] = useAutoAnimate()

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
            链接
          </Button>
        )}
      </div>

      <ul className={s.right}>
        <h3 className={s.noteTitle}>注意事项</h3>
        <li className={s.noteP}>改变顺序后可通过上方模板预览效果。</li>
        <li className={s.noteP}>不同模板间切换时，本组（第一组）链接组会被保留。</li>
      </ul>
    </div>
  )
}

export default Simple
