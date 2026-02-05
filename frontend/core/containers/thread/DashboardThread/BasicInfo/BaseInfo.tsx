import { find } from 'ramda'
import { LANGS_OPTIONS } from '~/const/i18n'
import useTrans from '~/hooks/useTrans'
import type { TSelectOption } from '~/spec'
import Input from '~/widgets/Input'
import Select from '~/widgets/Select'
import { FIELD } from '../constant'
import useBaseInfo from '../logic/useBaseInfo'
import SavingBar from '../SavingBar'
import useSalon from '../salon/basic_info/base_info'
import DangerZone from './DangerZone'

export default () => {
  const { saving, locale, desc, title, slug, homepage, introduction, isTouched, edit } =
    useBaseInfo()

  const s = useSalon()
  const { t } = useTrans()
  const curLangOption = find((o) => o.value === locale, LANGS_OPTIONS)

  return (
    <div className={s.wrapper}>
      <div className={s.label}>{t('dsb.base_info.default_locale.label')}</div>
      <Select
        value={curLangOption}
        options={LANGS_OPTIONS}
        placeholder={t('dsb.base_info.default_locale.placeholder')}
        onChange={(option: TSelectOption) => edit(option.value, 'locale')}
        top={2.5}
        bottom={5}
      />
      <p className={s.hint}>{t('dsb.base_info.default_locale.hint')}</p>

      <div className={s.label}>{t('dsb.base_info.subdomain.label')}</div>
      <Input value={slug} className={s.input} onChange={(v) => edit(v, 'slug')} />
      <p className={s.hint}>{t('dsb.base_info.subdomain.hint')}</p>
      <div className='mb-2.5' />

      <div className={s.label}>{t('dsb.base_info.title.label')}</div>
      <Input value={title} className={s.input} onChange={(v) => edit(v, 'title')} />

      <div className='mb-2.5' />

      <div className={s.label}>{t('dsb.base_info.homepage.label')}</div>
      <Input value={homepage} className={s.input} onChange={(v) => edit(v, 'homepage')} />
      <p className={s.hint}>{t('dsb.base_info.homepage.hint')}</p>

      <div className={s.label}>{t('dsb.base_info.desc.label')}</div>
      <Input
        placeholder={t('dsb.base_info.desc.placeholder')}
        value={desc}
        className={s.input}
        onChange={(v) => edit(v, 'desc')}
      />
      <div className='mb-4' />

      <div className={s.label}>{t('dsb.base_info.about.label')}</div>
      <Input
        behavior='textarea'
        placeholder={t('dsb.base_info.about.placeholder')}
        className={s.input}
        value={introduction}
        onChange={(v) => edit(v, 'introduction')}
      />

      {/* avoid show saving bar when loading community info */}
      {title && (
        <SavingBar field={FIELD.BASE_INFO} isTouched={isTouched} loading={saving} top={30} />
      )}

      <div className='mb-12' />
      <DangerZone />
    </div>
  )
}
