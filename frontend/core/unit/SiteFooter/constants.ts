export enum VIEW {
  HOME = 'home_view',
  // 常规社区, 类似 CP / javascript (+ 反馈与建议)
  COMMUNITY = 'community',
  HOSTING_COMMUNITY = 'hosting_community',
  ARTICLE = 'article',
}

export type TFooterView = `${VIEW}`
