import { ARTICLE_CAT } from '~/const/gtd'
import useSalon, { cn } from '../../../salon/articles_intro_tabs/kanban_tab/kanban_demo'
import Banner from './Banner'
import KanbanItem from './KanbanItem'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Banner />
      <div className={s.boards}>
        <div className={s.board}>
          <KanbanItem count={17} title='更新日志支持视频' cat={ARTICLE_CAT.FEATURE} />
          <KanbanItem
            className='opacity-85'
            count={4}
            title='新建社区名字重名'
            cat={ARTICLE_CAT.BUG}
          />
          <KanbanItem
            className='opacity-75'
            count={6}
            title='支持私有部署'
            cat={ARTICLE_CAT.FEATURE}
          />
          <KanbanItem
            className='opacity-50'
            count={13}
            title='编辑器粗体失效'
            cat={ARTICLE_CAT.BUG}
          />
          <KanbanItem
            className='opacity-35'
            count={2}
            title='支持多语言'
            cat={ARTICLE_CAT.FEATURE}
          />
          <KanbanItem className='opacity-25' />
        </div>
        <div className={cn(s.board, s.boardHighlight)}>
          <KanbanItem count={21} title='支持暗黑模式' cat={ARTICLE_CAT.FEATURE} />
          <KanbanItem
            draging
            className='opacity-85'
            count={11}
            title='手机标题点击失效'
            cat={ARTICLE_CAT.BUG}
          />
          <KanbanItem
            className='opacity-80'
            count={16}
            title='微信登录失效'
            cat={ARTICLE_CAT.BUG}
          />
          <KanbanItem
            className='opacity-60'
            count={21}
            title='Markdown 导入'
            cat={ARTICLE_CAT.FEATURE}
          />
          <KanbanItem
            className='opacity-30'
            count={9}
            title='CVS 导出备份'
            cat={ARTICLE_CAT.FEATURE}
          />
        </div>
        <div className={s.board}>
          <KanbanItem count={72} title='帖子支持多种布局' cat={ARTICLE_CAT.FEATURE} />
          <KanbanItem className='opacity-90' count={12} dragTarget />
          <KanbanItem
            className='opacity-80'
            count={12}
            title='管理员权限细化'
            cat={ARTICLE_CAT.FEATURE}
          />
          <KanbanItem
            className='opacity-65'
            count={41}
            title='SEO 信息显示重复'
            cat={ARTICLE_CAT.BUG}
          />
          <KanbanItem
            className='opacity-50'
            count={87}
            title='评论支持 @'
            cat={ARTICLE_CAT.FEATURE}
          />
          <KanbanItem
            className='opacity-30'
            count={62}
            title='评论支持盖楼'
            cat={ARTICLE_CAT.FEATURE}
          />
        </div>
      </div>
    </div>
  )
}
