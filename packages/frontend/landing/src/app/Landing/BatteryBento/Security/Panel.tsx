import type { FC } from 'react'

import NestlSVG from '~/icons/NestGlobal'

import LockSVG from '~/icons/Lock'
import SettingSVG from '~/icons/Setting'
import SearchSVG from '~/icons/HeaderSearch'
import AuthSVG from '~/icons/Auth'
import HashSVG from '~/icons/HashTagBold'
import UploadSVG from '~/icons/Upload'
import CloudSVG from '~/icons/CloudCheck'

import Header from './Header'
import useSalon, { cn } from '../../salon/battery_bento/security/panel'

type TProps = {
  hovering: boolean
}

const Panel: FC<TProps> = ({ hovering }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <NestlSVG className={cn(s.nestIcon, hovering && s.nextIconHover)} />

      <Header hovering={hovering} />

      <div className={cn(s.blocks, hovering && 'mt-5')}>
        <div className={cn(s.brick, hovering ? 'ml-4' : 'ml-2')}>
          <LockSVG className={s.icon} />
          <div className={s.title}>https加密</div>
        </div>
        <div className={s.brick}>
          <SettingSVG className={s.icon} />
          <div className={s.title}>外观自定义</div>
        </div>
        <div className={cn(s.brick, hovering ? 'ml-1' : 'ml-2')}>
          <UploadSVG className={s.icon} />
          <div className={s.title}>导入导出</div>
        </div>
        <div className={s.brick}>
          <HashSVG className={s.icon} />
          <div className={s.title}>用户标签</div>
        </div>
        <div className={s.brick}>
          <SearchSVG className={s.icon} />
          <div className={s.title}>SEO</div>
        </div>
        <div className={cn(s.brick, 'opacity-80', hovering ? 'ml-8' : 'ml-5')}>
          <AuthSVG className={s.icon} />
          <div className={s.title}>灵活权限</div>
        </div>
        <div className={cn(s.brick, 'opacity-80')}>
          <CloudSVG className={s.icon} />
          <div className={s.title}>私有部署</div>
        </div>
      </div>
    </div>
  )
}

export default Panel
