import { ARTICLE_CAT } from '~/const/gtd'
import useTrans from '~/hooks/useTrans'
import useSalon, { cn } from '../../../salon/articles_intro_tabs/kanban_tab/kanban_demo'
import Banner from './Banner'
import KanbanItem from './KanbanItem'

export default function KanbanDemo() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <Banner />
      <div className={s.boards}>
        <div className={s.board}>
          <KanbanItem
            count={17}
            title={t('landing.articles.kanban.demo.item.0')}
            cat={ARTICLE_CAT.FEATURE}
          />
          <KanbanItem
            className='opacity-85'
            count={4}
            title={t('landing.articles.kanban.demo.item.1')}
            cat={ARTICLE_CAT.BUG}
          />
          <KanbanItem
            className='opacity-75'
            count={6}
            title={t('landing.articles.kanban.demo.item.2')}
            cat={ARTICLE_CAT.FEATURE}
          />
          <KanbanItem
            className='opacity-50'
            count={13}
            title={t('landing.articles.kanban.demo.item.3')}
            cat={ARTICLE_CAT.BUG}
          />
          <KanbanItem
            className='opacity-35'
            count={2}
            title={t('landing.articles.kanban.demo.item.4')}
            cat={ARTICLE_CAT.FEATURE}
          />
          <KanbanItem className='opacity-25' />
        </div>
        <div className={cn(s.board, s.boardHighlight)}>
          <KanbanItem
            count={21}
            title={t('landing.articles.kanban.demo.item.5')}
            cat={ARTICLE_CAT.FEATURE}
          />
          <KanbanItem
            draging
            className='opacity-85'
            count={11}
            title={t('landing.articles.kanban.demo.item.6')}
            cat={ARTICLE_CAT.BUG}
          />
          <KanbanItem
            className='opacity-80'
            count={16}
            title={t('landing.articles.kanban.demo.item.7')}
            cat={ARTICLE_CAT.BUG}
          />
          <KanbanItem
            className='opacity-60'
            count={21}
            title={t('landing.articles.kanban.demo.item.8')}
            cat={ARTICLE_CAT.FEATURE}
          />
          <KanbanItem
            className='opacity-30'
            count={9}
            title={t('landing.articles.kanban.demo.item.9')}
            cat={ARTICLE_CAT.FEATURE}
          />
        </div>
        <div className={s.board}>
          <KanbanItem
            count={72}
            title={t('landing.articles.kanban.demo.item.10')}
            cat={ARTICLE_CAT.FEATURE}
          />
          <KanbanItem className='opacity-90' count={12} dragTarget />
          <KanbanItem
            className='opacity-80'
            count={12}
            title={t('landing.articles.kanban.demo.item.11')}
            cat={ARTICLE_CAT.FEATURE}
          />
          <KanbanItem
            className='opacity-65'
            count={41}
            title={t('landing.articles.kanban.demo.item.12')}
            cat={ARTICLE_CAT.BUG}
          />
          <KanbanItem
            className='opacity-50'
            count={87}
            title={t('landing.articles.kanban.demo.item.13')}
            cat={ARTICLE_CAT.FEATURE}
          />
          <KanbanItem
            className='opacity-30'
            count={62}
            title={t('landing.articles.kanban.demo.item.14')}
            cat={ARTICLE_CAT.FEATURE}
          />
        </div>
      </div>
    </div>
  )
}
