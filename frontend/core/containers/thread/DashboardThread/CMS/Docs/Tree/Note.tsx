import useTrans from '~/hooks/useTrans'
import useSalon from '../../../salon/cms/docs/tree/note'

export default () => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>{t('dsb.cms.docs.tree.note.title')}</div>
      <ul className={s.ul}>
        <li className={s.li}>{t('dsb.cms.docs.tree.note.item.sort')}</li>
        <li className={s.li}>{t('dsb.cms.docs.tree.note.item.navigate')}</li>
        <li className={s.li}>{t('dsb.cms.docs.tree.note.item.create')}</li>
        <li className={s.li}>{t('dsb.cms.docs.tree.note.item.delete_doc')}</li>
        <li className={s.li}>{t('dsb.cms.docs.tree.note.item.delete_folder')}</li>
        <li className={s.li}>{t('dsb.cms.docs.tree.note.item.toggle')}</li>
      </ul>
    </div>
  )
}
