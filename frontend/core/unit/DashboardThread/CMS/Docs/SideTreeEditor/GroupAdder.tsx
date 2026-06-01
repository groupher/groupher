import PlusSVG from '~/icons/Plus'

import useSalon from './salon/group_adder'

type TProps = {
  onAddGroup: () => void
}

const GroupAdder = ({ onAddGroup }: TProps) => {
  const s = useSalon()

  return (
    <button type='button' className={s.wrapper} onClick={onAddGroup}>
      <PlusSVG className={s.plusIcon} />
      <div className={s.title}>Add group</div>
    </button>
  )
}

export default GroupAdder
