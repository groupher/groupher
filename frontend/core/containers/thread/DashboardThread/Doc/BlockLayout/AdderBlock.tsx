import PlusSVG from '~/icons/BoxAdd'

import useDoc from '../../logic/useDoc'
import useSalon from '../../salon/doc/block_layout/adder_block'

export default function AdderBlock() {
  const s = useSalon()
  const { addDocCategory } = useDoc()

  return (
    <div className={s.wrapper} onClick={() => addDocCategory()}>
      <PlusSVG className={s.addIcon} />
      <div className={s.title}>添加新分类</div>
    </div>
  )
}
