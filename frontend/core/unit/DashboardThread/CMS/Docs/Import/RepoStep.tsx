import type { FormEvent } from 'react'

import useTrans from '~/hooks/useTrans'
import { MARKDOWN_PLATFORMS } from '~/unit/DashboardThread/CMS/Docs/markdown_platforms'
import Button from '~/widgets/Buttons/Button'
import Input from '~/widgets/Input'
import LogoList from '~/widgets/LogoList'

import useSalon from './salon/repo_step'

type TProps = {
  analyze: () => Promise<void>
  error: string
  repoUrl: string
  setRepoUrl: (value: string) => void
}

/** Collects the public GitHub repository URL and starts Preview analysis. */
export default function RepoStep(props: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const submit = (event: FormEvent): void => {
    event.preventDefault()
    void props.analyze()
  }

  return (
    <form className={s.wrapper} onSubmit={submit}>
      <h2 className={s.title}>{t('dsb.doc.bulk_import.repository.title')}</h2>
      <p className={s.description}>
        <span>{t('dsb.doc.bulk_import.repository.desc')}</span>
        <span className={s.descriptionHint}>{t('dsb.doc.bulk_import.repository.hint')}</span>
      </p>
      <label className={s.label} htmlFor='bulk-import-repo'>
        {t('dsb.doc.bulk_import.repository.label')}
      </label>
      <Input
        className={s.input}
        id='bulk-import-repo'
        onChange={(event) => props.setRepoUrl(event.target.value)}
        placeholder='https://github.com/acme/docs'
        required
        type='url'
        value={props.repoUrl}
      />
      {props.error && <p className={s.error}>{props.error}</p>}
      <footer className={s.footer}>
        <div className={s.platforms}>
          <span className={s.platformsTitle}>{t('dsb.doc.bulk_import.repository.platforms')}</span>
          <LogoList items={MARKDOWN_PLATFORMS} top={1} />
        </div>
        <Button type='submit'>{t('dsb.doc.bulk_import.repository.analyze')}</Button>
      </footer>
    </form>
  )
}
