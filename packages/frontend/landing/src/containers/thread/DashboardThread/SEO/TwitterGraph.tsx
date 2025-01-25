import type { TSelectOption } from '~/spec'
import Select from '~/widgets/Select'
import Input from '~/widgets/Input'

import { TW_CARD_OPTIONS } from '../constant'

import TwitterPreview from './TwitterPreview'
import useSEO from '../logic/useSEO'
import useSalon from '../salon/seo/twitter_graph'

export default () => {
  const s = useSalon()
  const { twTitle, twDescription, twUrl, twSite, twCard, edit } = useSEO()

  return (
    <div className={s.wrapper}>
      <TwitterPreview />
      <div className="mt-10" />
      <label className={s.label}>twitter:title</label>
      <Input className={s.input} value={twTitle} onChange={(e) => edit(e, 'twTitle')} />
      <label className={s.label}>twitter:description</label>
      <Input className={s.input} value={twDescription} onChange={(e) => edit(e, 'twDescription')} />
      <label className={s.label}>twitter:url</label>
      <Input className={s.input} value={twUrl} onChange={(e) => edit(e, 'twUrl')} />
      <label className={s.label}>twitter:site</label>
      <Input className={s.input} value={twSite} onChange={(e) => edit(e, 'twSite')} />
      <label className={s.label}>twitter:card</label>
      {/* <Inputer value={twCard} onChange={(e) => edit(e, 'twCard')} /> */}
      <div className={s.selectWrapper}>
        <Select
          value={{ label: twCard, value: twCard }}
          options={TW_CARD_OPTIONS}
          placeholder="请选择标签所在分组"
          onChange={(option: TSelectOption) => edit(option.value, 'twCard')}
        />
      </div>

      <label className={s.label}>twitter:image</label>
      <Input className={s.input} />
    </div>
  )
}
