import useArticleActivity from '~/hooks/useArticleActivity'
import useTrans from '~/hooks/useTrans'
import Img from '~/Img'
import type { TTransKey } from '~/spec'
import ImgFallback from '~/ui/ImgFallback'

import useSalon, { cn } from '../salon/activities'

function actionLabel(action: string, t: (key: string) => string): string {
  const key = `article.footer.activity.action.${action.toLowerCase()}`
  const translated = t(key as TTransKey)
  return translated === '--' ? action.replaceAll('_', ' ') : translated
}

function occurredAtLabel(value: string, locale: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function Activities() {
  const s = useSalon()
  const { t, locale } = useTrans()
  const query = useArticleActivity()
  const entries = query.data?.pages.flatMap((page) => page.entries) ?? []

  if (query.isPending) {
    return (
      <p className='text-digest py-4 text-sm' role='status'>
        {t('article.footer.activity.loading')}
      </p>
    )
  }

  if (query.isError) {
    return (
      <div className='py-4'>
        <p className='text-digest text-sm' role='status'>
          {t('article.footer.activity.failed')}
        </p>
        <button
          type='button'
          className='text-accent mt-2 text-sm hover:underline'
          onClick={() => void query.refetch()}
        >
          {t('article.footer.activity.retry')}
        </button>
      </div>
    )
  }

  if (entries.length === 0) {
    return <p className='text-digest py-4 text-sm'>{t('article.footer.activity.empty')}</p>
  }

  return (
    <div className={s.wrapper}>
      <ol className='space-y-4'>
        {entries.map((entry) => {
          const actor = {
            login: entry.actor.login ?? '',
            avatar: entry.actor.avatar ?? '',
          }

          return (
            <li key={entry.id} className={s.item}>
              <div className={cn(s.tail, '-bottom-3.5 h-2.5')} />
              <Img
                src={actor.avatar}
                className={s.avatar}
                fallback={<ImgFallback user={actor} left={-0.5} />}
              />
              <div className={s.content}>
                <span className={cn(s.highlight, 'mr-1')}>
                  {entry.actor.nickname || entry.actor.login || t('article.footer.activity.system')}
                </span>
                {actionLabel(entry.action, t)}
                {entry.target?.url && entry.target.title ? (
                  <a className='text-accent ml-1 hover:underline' href={entry.target.url}>
                    {entry.target.title}
                  </a>
                ) : (
                  (entry.action === 'ticket_created' || entry.action === 'ticket_linked') && (
                    <span className='text-digest ml-1'>
                      {t('article.footer.activity.ticket_unavailable')}
                    </span>
                  )
                )}
                <time className='text-digest ml-2 text-xs' dateTime={entry.occurredAt}>
                  {occurredAtLabel(entry.occurredAt, locale)}
                </time>
              </div>
            </li>
          )
        })}
      </ol>

      {query.hasNextPage && (
        <button
          type='button'
          className='text-accent mt-4 text-sm hover:underline'
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetchingNextPage
            ? t('article.footer.activity.loading')
            : t('article.footer.activity.more')}
        </button>
      )}
    </div>
  )
}
