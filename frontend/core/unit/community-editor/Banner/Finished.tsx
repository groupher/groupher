/* eslint-disable jsx-a11y/accessible-emoji */
import Link from 'next/link'

import { ROUTE } from '~/const/route'

import Img from '~/Img'
import ArrowSVG from '~/icons/ArrowUpRight'

import useLogic from '../useLogic'
import useSalon, { cn } from '../salon/banner/finished'

export default function Finished() {
  const s = useSalon()
  const { logo, title, slug, desc } = useLogic()

  return (
    <div className={s.wrapper}>
      <h3 className={s.title}>👏🏻 &nbsp;&nbsp;社区已创建成功</h3>
      <div className={s.desc}>感谢您的信任，在此之前你可以去管理后台完善相关社区设置</div>
      <div className={s.frame}>
        <div className={s.leftFrame}>
          <Img src={logo} className="size-12" />
          <div className={s.communityTitle}>{title}</div>
          <div className={s.communityDesc}>{desc}</div>
          <Link href={`/${slug}`} className={s.gotoLink}>
            社区主页 <ArrowSVG className={s.gotoLinkIcon} />
          </Link>
        </div>
        <div className={s.rightFrame}>
          <Link href={`/${slug}/${ROUTE.DASHBOARD.LAYOUT}`} className={s.dashItem}>
            <div>
              <div className={s.dashTitle}>
                布局样式 <ArrowSVG className={s.linkIcon} />
              </div>
              <div className={s.dashDesc}>社区外观，展现样式，关于信息等</div>
            </div>
          </Link>

          <Link href={`/${slug}/${ROUTE.DASHBOARD.THREADS}`} className={s.dashItem}>
            <div>
              <div className={s.dashTitle}>
                社区板块 <ArrowSVG className={s.linkIcon} />
              </div>
              <div className={s.dashDesc}>是否开通看板，更新日志，文档等</div>
            </div>
          </Link>

          <Link href={`/${slug}/${ROUTE.DASHBOARD.ADMINS}`} className={s.dashItem}>
            <div>
              <div className={s.dashTitle}>
                管理员 <ArrowSVG className={s.linkIcon} />
              </div>
              <div className={s.dashDesc}>添加社区管理员，权限设置等。</div>
            </div>
          </Link>

          <Link href={`/${slug}/${ROUTE.DASHBOARD.TAGS}`} className={s.dashItem}>
            <div>
              <div className={s.dashTitle}>
                标签编辑 <ArrowSVG className={s.linkIcon} />
              </div>
              <div className={s.dashDesc}>编辑讨论区，更新日志等板块的标签。</div>
            </div>
          </Link>

          <Link href={`/${slug}/${ROUTE.DASHBOARD.ADMINS}`} className={s.dashItem}>
            <div>
              <div className={s.dashTitle}>
                数据导入 <ArrowSVG className={s.linkIcon} />
              </div>
              <div className={s.dashDesc}>从兔小巢，Github Discusstion 等平台导入历史数据</div>
            </div>
          </Link>

          <div className={s.divider} />
          <Link
            href={`/${slug}/${ROUTE.DASHBOARD.OVERVIEW}`}
            className={cn(s.gotoLink, s.goDashboard)}
          >
            前往控制台 <ArrowSVG className={s.gotoLinkIcon} />
          </Link>
        </div>
      </div>
    </div>
  )
}
