import { useState, type FC, type FormEvent } from 'react'

import useTrans from '~/hooks/useTrans'
import LogoList from '~/ui/LogoList'
import { MARKDOWN_PLATFORMS } from '~/unit/DashboardThread/CMS/Docs/markdown_platforms'

import useSalon from './salon/platform_url_picker'

type TProps = {
  pending: boolean
  onSubmit: (url: string) => void
}

const PlatformUrlPicker: FC<TProps> = ({ pending, onSubmit }) => {
  const s = useSalon()
  const { t } = useTrans()
  const [url, setUrl] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    if (!url.trim() || pending) return
    onSubmit(url.trim())
  }

  return (
    <form className={s.platformForm} onSubmit={handleSubmit}>
      <label className={s.platformLabel} htmlFor='documentation-import-url'>
        {t('dsb.doc.import.platform.label')}
      </label>
      <div className={s.platformInputRow}>
        <input
          id='documentation-import-url'
          className={s.platformInput}
          type='url'
          inputMode='url'
          autoComplete='url'
          disabled={pending}
          placeholder={t('dsb.doc.import.platform.placeholder')}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <button
          type='submit'
          className={s.platformSubmit}
          disabled={pending || !url.trim()}
          aria-busy={pending}
        >
          {pending ? t('dsb.doc.import.platform.fetching') : t('dsb.doc.import.platform.fetch')}
        </button>
      </div>
      <div className={s.platformHint}>
        <p className={s.platformHintText}>{t('dsb.doc.import.platform.hint')}</p>
        <LogoList items={MARKDOWN_PLATFORMS} wrap />
      </div>
    </form>
  )
}

export default PlatformUrlPicker
