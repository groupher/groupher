import { keys } from 'ramda'

import { mockHelpCats } from '~/mock'
import IconHub from '~/widgets/IconHub'
import ICONS, { PROVIDERS } from '~/widgets/IconHub/icons'

import useSalon from '../salon/brief_cards_layout'
import Category from './Category'

export default function BriefCardsLayout() {
  const cats = mockHelpCats()
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className='column mb-8 gap-8'>
        {PROVIDERS.map((provider) => {
          const providerIcons = ICONS[provider]
          const iconKeys = keys(providerIcons)

          return (
            <section key={provider} className='column gap-4'>
              <h3 className='text-title text-lg capitalize'>{provider}</h3>
              <div className='grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10'>
                {iconKeys.map((icon) => (
                  <div
                    key={`${provider}-${icon}`}
                    className='column border-divider items-center gap-2 rounded-md border p-3'
                  >
                    <IconHub provider={provider} icon={icon} size={4} />
                    <div className='cut-text text-digest w-full text-center text-xs'>{icon}</div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <div className={s.groups}>
        {cats.map((cat) => (
          <Category key={cat.id} title={cat.title} articles={cat.articles} />
        ))}
      </div>
    </div>
  )
}
