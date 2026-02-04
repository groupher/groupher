import Button from '~/widgets/Buttons/Button'

import AdderSVG from '~/icons/Plus'
import useTrans from '~/hooks/useTrans'

import useDoc from '../../../logic/useDoc'
import useSalon from '../../../salon/cms/docs/faq/adder'

export default () => {
  const s = useSalon()
  const { addFAQSection } = useDoc()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
        <Button onClick={addFAQSection} className={s.addBtn}>
          <AdderSVG className={s.addIcon} />
          {t('dsb.cms.faq.add.title')}
        </Button>
      <div className={s.notes}>{t('dsb.cms.faq.add.desc')}</div>
    </div>
  )
}
