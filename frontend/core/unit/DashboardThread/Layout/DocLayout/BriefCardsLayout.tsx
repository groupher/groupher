import ToolSVG from '~/icons/Book'

import useSalon, { cnMerge } from '../../salon/layout/doc_layout/brief_cards_layout'

export default function BriefCardsLayout() {
  const s = useSalon()

  return (
    <div className={s.block}>
      <div className={cnMerge(s.itemTitle, 'mb-3 w-10 opacity-40 ml-0.5')} />
      <div className={s.items}>
        <div className={s.item}>
          <div className={cnMerge(s.iconBox)}>
            <ToolSVG className={s.icon} />
          </div>
          <div className={s.copy}>
            <div className={s.itemTitle} />
            <div className={s.itemDesc} />
            <div className={cnMerge(s.itemDesc, 'w-6')} />
          </div>
        </div>

        <div className={s.item}>
          <div className={cnMerge(s.iconBox)}>
            <ToolSVG className={s.icon} />
          </div>
          <div className={s.copy}>
            <div className={s.itemTitle} />
            <div className={s.itemDesc} />
            <div className={cnMerge(s.itemDesc, 'w-6')} />
          </div>
        </div>

        <div className={s.item}>
          <div className={cnMerge(s.iconBox)}>
            <ToolSVG className={s.icon} />
          </div>
          <div className={s.copy}>
            <div className={s.itemTitle} />
            <div className={s.itemDesc} />
            <div className={cnMerge(s.itemDesc, 'w-6')} />
          </div>
        </div>

        <div className={s.item}>
          <div className={cnMerge(s.iconBox)}>
            <ToolSVG className={s.icon} />
          </div>
          <div className={s.copy}>
            <div className={s.itemTitle} />
            <div className={s.itemDesc} />
            <div className={cnMerge(s.itemDesc, 'w-6')} />
          </div>
        </div>

        <div className={s.item}>
          <div className={cnMerge(s.iconBox)}>
            <ToolSVG className={s.icon} />
          </div>
          <div className={s.copy}>
            <div className={s.itemTitle} />
            <div className={s.itemDesc} />
            <div className={cnMerge(s.itemDesc, 'w-6')} />
          </div>
        </div>
      </div>

      <div className={cnMerge(s.itemTitle, 'mt-5 mb-3 w-8 opacity-40 ml-0.5')} />
      <div className={s.items}>
        <div className={s.item}>
          <div className={cnMerge(s.iconBox)}>
            <ToolSVG className={s.icon} />
          </div>
          <div className={s.copy}>
            <div className={s.itemTitle} />
            <div className={s.itemDesc} />
            <div className={cnMerge(s.itemDesc, 'w-6')} />
          </div>
        </div>

        <div className={s.item}>
          <div className={cnMerge(s.iconBox)}>
            <ToolSVG className={s.icon} />
          </div>
          <div className={s.copy}>
            <div className={s.itemTitle} />
            <div className={s.itemDesc} />
            <div className={cnMerge(s.itemDesc, 'w-6')} />
          </div>
        </div>
      </div>

      <div className={cnMerge(s.itemTitle, 'mt-5 mb-3 w-8 opacity-40 ml-0.5')} />
      <div className={s.items}>
        <div className={s.item}>
          <div className={cnMerge(s.iconBox)}>
            <ToolSVG className={s.icon} />
          </div>
          <div className={s.copy}>
            <div className={s.itemTitle} />
            <div className={s.itemDesc} />
            <div className={cnMerge(s.itemDesc, 'w-6')} />
          </div>
        </div>

        <div className={s.item}>
          <div className={cnMerge(s.iconBox)}>
            <ToolSVG className={s.icon} />
          </div>
          <div className={s.copy}>
            <div className={s.itemTitle} />
            <div className={s.itemDesc} />
            <div className={cnMerge(s.itemDesc, 'w-6')} />
          </div>
        </div>

        <div className={s.item}>
          <div className={cnMerge(s.iconBox)}>
            <ToolSVG className={s.icon} />
          </div>
          <div className={s.copy}>
            <div className={s.itemTitle} />
            <div className={s.itemDesc} />
            <div className={cnMerge(s.itemDesc, 'w-6')} />
          </div>
        </div>
      </div>
    </div>
  )
}
