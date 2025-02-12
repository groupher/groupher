// this is tmp, use react-i18n .. later

const I18nDict = {
  'community.add_moderator': '添加社区管理员',
  'post.article_tag.create': '创建帖子标签',
  'post.article_tag.edit': '编辑帖子标签',
  'post.mark_delete': '删除帖子',
}

export const Trans = (key) => I18nDict[key] || key

export const holder = 1
