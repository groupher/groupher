import { find } from 'ramda'
import { LANGS_OPTIONS } from '~/const/i18n'
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
  const curLangOption = find((o) => o.value === locale, LANGS_OPTIONS)

  return (
    <div className={s.wrapper}>
      <div className={s.label}>默认语言</div>
      <Select
        value={curLangOption}
        options={LANGS_OPTIONS}
        placeholder='社区默认语言'
        onChange={(option: TSelectOption) => edit(option.value, 'locale')}
        top={2.5}
        bottom={5}
      />
      <p className={s.hint}>社区界面的默认语言</p>

      <div className={s.label}>社区域名</div>
      <Input value={slug} className={s.input} onChange={(v) => edit(v, 'slug')} />
      <p className={s.hint}>
        社区的 URL 地址段，填写后可通过 https://groupher.com/[slug] 或 https://[slug].groupher.com
        访问。
      </p>
      <div className='mb-2.5' />

      <div className={s.label}>社区名称</div>
      <Input value={title} className={s.input} onChange={(v) => edit(v, 'title')} />

      <div className='mb-2.5' />

      <div className={s.label}>官方主页</div>
      <Input value={homepage} className={s.input} onChange={(v) => edit(v, 'homepage')} />
      <p className={s.hint}>您产品或服务的官方地址。</p>

      <div className={s.label}>社区简介</div>
      <Input
        placeholder='一句话简介'
        value={desc}
        className={s.input}
        onChange={(v) => edit(v, 'desc')}
      />
      <div className='mb-4' />

      <div className={s.label}>关于社区</div>
      <Input
        behavior='textarea'
        placeholder='支持 Markdown 语法'
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
