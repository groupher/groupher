import type { TSelectOption } from '~/spec'
import Input from '~/widgets/Input'
import Select from '~/widgets/Select'

import { TW_CARD_OPTIONS } from '../constant'
import useSEO from '../logic/useSEO'
import useSalon from '../salon/seo/twitter_graph'
import TwitterPreview from './TwitterPreview'

export default () => {
  const s = useSalon()
  const { twTitle, twDescription, twUrl, twSite, twCard, edit } = useSEO()

  return (
    <div className={s.wrapper}>
      <TwitterPreview />
      <div className='mt-10' />
      <label htmlFor='tw-title' className={s.label}>
        twitter:title
      </label>
      <Input
        id='tw-title'
        className={s.input}
        value={twTitle}
        onChange={(e) => edit(e, 'twTitle')}
      />
      <label htmlFor='tw-description' className={s.label}>
        twitter:description
      </label>
      <Input
        id='tw-description'
        className={s.input}
        value={twDescription}
        onChange={(e) => edit(e, 'twDescription')}
      />
      <label htmlFor='tw-url' className={s.label}>
        twitter:url
      </label>
      <Input id='tw-url' className={s.input} value={twUrl} onChange={(e) => edit(e, 'twUrl')} />
      <label htmlFor='tw-site' className={s.label}>
        twitter:site
      </label>
      <Input id='tw-site' className={s.input} value={twSite} onChange={(e) => edit(e, 'twSite')} />
      <label htmlFor='tw-card' className={s.label}>
        twitter:card
      </label>
      {/* <Inputer value={twCard} onChange={(e) => edit(e, 'twCard')} /> */}
      <div className={s.selectWrapper}>
        <Select
          value={{ label: twCard, value: twCard }}
          options={TW_CARD_OPTIONS}
          placeholder='请选择标签所在分组'
          onChange={(option: TSelectOption) => edit(option.value, 'twCard')}
        />
      </div>

      <label htmlFor='tw-image' className={s.label}>
        twitter:image
      </label>
      <Input id='tw-image' className={s.input} />
    </div>
  )
}
