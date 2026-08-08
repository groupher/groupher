import useTrans from '~/hooks/useTrans'
import ToggleSwitch from '~/ui/Buttons/ToggleSwitch'
import RangeSlider from '~/ui/RangeSlider'
import Radio from '~/ui/Switcher/Radio'

import useRSS from '../logic/useRSS'
import Portal from '../Portal'
import SavingBar from '../SavingBar'
import SectionLabel from '../SectionLabel'
import useSalon from './salon'

const FEED_THREADS = [
  { id: 'post', title: 'dsb.press.thread.post.title', desc: 'dsb.press.thread.post.desc' },
  { id: 'blog', title: 'dsb.press.thread.blog.title', desc: 'dsb.press.thread.blog.desc' },
  {
    id: 'changelog',
    title: 'dsb.press.thread.changelog.title',
    desc: 'dsb.press.thread.changelog.desc',
  },
  { id: 'doc', title: 'dsb.press.thread.doc.title', desc: 'dsb.press.thread.doc.desc' },
] as const

export default function RSS() {
  const s = useSalon()
  const { t } = useTrans()

  const rss = useRSS()
  const { rssFeedType, rssFeedCount, isTouched, edit, rssOnSave, rssOnCancel } = rss

  return (
    <div className={s.wrapper}>
      <Portal title={t('dsb.press.title')} desc={t('dsb.press.desc')} />
      <div className={s.innerWrapper}>
        <SectionLabel
          title={t('dsb.press.markdown.title')}
          desc={t('dsb.press.markdown.desc')}
          addon={
            <ToggleSwitch
              checked={rss.markdownEnabled}
              onChange={(value) => rss.toggleOutput('markdownEnabled', value)}
            />
          }
        />
        <SectionLabel
          title={t('dsb.press.feed.title')}
          desc={t('dsb.press.feed.desc')}
          addon={
            <ToggleSwitch
              checked={rss.feedEnabled}
              onChange={(value) => rss.toggleOutput('feedEnabled', value)}
            />
          }
        />
        <SectionLabel
          title={t('dsb.press.llms.title')}
          desc={t('dsb.press.llms.desc')}
          addon={
            <ToggleSwitch
              checked={rss.llmsEnabled}
              onChange={(value) => rss.toggleOutput('llmsEnabled', value)}
            />
          }
        />
        <SectionLabel
          title={t('dsb.press.sitemap.title')}
          desc={t('dsb.press.sitemap.desc')}
          addon={
            <ToggleSwitch
              checked={rss.sitemapEnabled}
              onChange={(value) => rss.toggleOutput('sitemapEnabled', value)}
            />
          }
        />
        {rss.feedEnabled &&
          FEED_THREADS.map((thread) => (
            <SectionLabel
              key={thread.id}
              title={t(thread.title)}
              desc={t(thread.desc)}
              addon={
                <ToggleSwitch
                  checked={rss.feedThreads.includes(thread.id)}
                  onChange={(value) => rss.toggleThread(thread.id, value)}
                />
              }
            />
          ))}
        <div className={s.setting}>
          <h3 className={s.title}>{t('dsb.rss.feed_type')}</h3>
          <Radio
            size='small'
            items={[
              {
                value: t('dsb.rss.feed_full'),
                key: 'full',
              },
              {
                value: t('dsb.rss.feed_digest'),
                key: 'digest',
              },
            ]}
            activeKey={rssFeedType}
            onChange={(item) => edit(item.key, 'rssFeedType')}
          />
        </div>

        <div className={s.setting}>
          <h3 className={s.title}>{t('dsb.rss.feed_count')}</h3>
          <RangeSlider
            width='w-48'
            bottom={12}
            value={rssFeedCount}
            min={5}
            max={50}
            onChange={(v) => edit(v, 'rssFeedCount')}
            unit={t('dsb.rss.unit')}
          />
        </div>

        <SavingBar
          isTouched={isTouched}
          disabled={!rss.canSave}
          hint={!rss.canSave ? t('dsb.press.feed.thread_required') : undefined}
          onCancel={() => rssOnCancel()}
          onConfirm={() => rssOnSave()}
          top={10}
        />
      </div>
    </div>
  )
}
