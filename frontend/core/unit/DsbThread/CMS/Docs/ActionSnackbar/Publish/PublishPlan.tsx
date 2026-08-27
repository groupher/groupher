import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'

import { SAVE_ACTION_LABEL_KEY } from '../constant'
import useSalon from './salon/publish_plan'
import type { TPublishPlan, TPublishChecklistItem } from './spec'

type TSection = {
  title: string
  items: TPublishChecklistItem[]
}

type TProps = {
  plan: TPublishPlan
}

const PublishPlan: FC<TProps> = ({ plan }) => {
  const s = useSalon()
  const { t } = useTrans()
  const sections: TSection[] = [
    {
      title: t(SAVE_ACTION_LABEL_KEY.PUBLISH_WILL_PUBLISH),
      items: plan.publishItems,
    },
    {
      title: t(SAVE_ACTION_LABEL_KEY.PUBLISH_WILL_RESTORE),
      items: plan.restoreItems,
    },
    {
      title: t(SAVE_ACTION_LABEL_KEY.PUBLISH_KEPT_DRAFT),
      items: plan.keptDraftItems,
    },
  ].filter((section) => section.items.length > 0)

  if (sections.length === 0) return null

  return (
    <div className={s.plan}>
      {sections.map((section) => (
        <section key={section.title} className={s.section}>
          <div className={s.heading}>
            <span>{section.title}</span>
            <span className={s.count}>{section.items.length}</span>
          </div>
          <ul className={s.items}>
            {section.items.map((item) => (
              <li key={item.id} className={s.item}>
                <span className={s.title}>{item.title}</span>
                <span className={s.action(item.action)}>{item.action}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export default PublishPlan
