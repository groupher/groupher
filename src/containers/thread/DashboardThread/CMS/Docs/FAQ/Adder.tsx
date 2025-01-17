import Button from '~/widgets/Buttons/Button'

import AdderSVG from '~/icons/Plus'

import useDoc from '../../../logic/useDoc'
import useSalon from '../../../salon/cms/docs/faq/adder'

export default () => {
  const s = useSalon()
  const { addFAQSection } = useDoc()

  return (
    <div className={s.wrapper}>
      <Button onClick={addFAQSection} className={s.addBtn}>
        <AdderSVG className={s.addIcon} />
        新问题块
      </Button>
      <div className={s.notes}>问题块包含标题及内容，可自主折叠，自定义展示顺序等。</div>
    </div>
  )
}
