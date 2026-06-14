import useTrans from '~/hooks/useTrans'
import PlusSVG from '~/icons/Plus'

import useSalon from './salon/group_adder'

type TProps = {
  hasGroups: boolean
  onAddGroup: () => void
}

const GroupAdder = ({ hasGroups, onAddGroup }: TProps) => {
  const s = useSalon(hasGroups)
  const { t } = useTrans()

  return (
    <button type='button' className={s.wrapper} onClick={onAddGroup}>
      <PlusSVG className={s.plusIcon} />
      <div className={s.title}>{t('dsb.cms.docs.side_tree.add_group')}</div>
    </button>
  )
}

export default GroupAdder
