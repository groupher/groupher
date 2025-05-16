'use client'

import Link from 'next/link'

import { EMAIL_SUPPORT } from '~/config'

import { COLOR_NAME } from '~/const/colors'
import CoffeeSVG from '~/icons/CoffeeDuo'

import useHover from '~/hooks/useHover'
// import useThemeData from '~/hooks/useThemeData'

import Img from '~/Img'
// import AnimatedCount from '~/widgets/AnimatedCount'
import Button from '~/widgets/Buttons/Button'

import Feature from './Feature'

import { FREE_PAN_ITEMS, PAID_PAN_ITEMS, CUSTOM_PAN_ITEMS } from './constant'

import useSalon, { cn } from './salon'

type TProps = {
  layout?: 'page' | 'modal'
}

export default ({ layout = 'page' }: TProps) => {
  const s = useSalon()

  const [paidHoveredRef, paidHovered] = useHover<HTMLDivElement>()
  // const themeData = useThemeData()

  return (
    <div className={cn(s.wrapper, layout === 'modal' && 'scale-95 mb-0')}>
      {layout === 'page' ? (
        <>
          <h3 className={s.bannerTitle}>与用户社区一起，走的更远</h3>
          <div className={s.bannerDesc}>无套路，无广告，持续迭代，开放透明</div>
        </>
      ) : (
        <>
          <div className={s.bannerNote}>请升级到高级版本解锁该功能 👇</div>
        </>
      )}

      <div className={s.inner}>
        <div className={s.column}>
          <div className={s.gradientGreen} />
          <h4 className={cn(s.toppingTitle, s.fgGreen)}>交个朋友</h4>
          <div className={s.desc}>您的产品刚刚起步，需要公共空间和潜在用户交流探讨。</div>
          <div className={s.price}>
            <span className={s.priceUnit}>¥</span>
            <div className={cn(s.priceNum, 'ml-1.5')}>0</div>
            <div className={s.priceDesc}>元/月</div>
          </div>
          <div className={s.note}>可随时升级或注销</div>
          <div className={s.board}>
            {FREE_PAN_ITEMS.map((item) => (
              <Feature key={item.key} title={item.title} color={COLOR_NAME.GREEN} />
            ))}
          </div>
          <Button ghost>创建社区实例</Button>
        </div>
        <div ref={paidHoveredRef} className={s.column}>
          <div className={s.gradientOrange} />
          <Img
            src="/landing/catpaw.png"
            className={cn(
              s.catPawImg,
              paidHovered ? 'top-36 -left-1 mt-1' : 'top-20 left-2.5 -mt-3',
            )}
            alt="cat paw"
          />
          <h4 className={cn(s.toppingTitle, s.fgBrown)}>如虎添翼</h4>
          <div className={s.desc}>您的产品已有一定规模，希望解锁社区更多功能获得进一步增长。</div>
          <div className={s.price}>
            <span className={s.priceUnit}>¥</span>
            <div className={s.priceNum}>
              {/* <AnimatedCount
                count={paidHovered ? 9 : 0}
                forceColor={themeData.article.title}
                left={2}
                top={-0.5}
                size="huge"
              /> */}
              <div className="opacity-35">.</div>
              {/* <AnimatedCount
                count={paidHovered ? 9 : 0}
                forceColor={themeData.article.title}
                top={0.5}
                size="large"
              /> */}
            </div>
            <div className={s.priceDesc}>元/月</div>
          </div>
          <div className={cn(s.catNote, !paidHovered ? 'mt-14' : 'mt-1')}>
            内测折扣价，可随时退款
          </div>

          <div className={cn(s.board, 'absolute bottom-14 mt-5')}>
            {PAID_PAN_ITEMS.map((item) => (
              <Feature key={item.key} title={item.title} color={COLOR_NAME.ORANGE} />
            ))}
          </div>
          <div className={s.tryButton}>
            <Button>开始 30 天试用</Button>
          </div>
        </div>
        <div className={s.column}>
          <div className={s.gradientPurple} />
          <h4 className={cn(s.toppingTitle, s.fgPurple)}>定制开发</h4>
          <div className={s.desc}>您的产品需要更加个性化的功能，我们可提供量身定做服务。</div>
          <div className={s.letsTalk}>
            <CoffeeSVG className={s.coffeeIcon} />
            一起聊聊吧！
          </div>
          <div className={s.note}>对社区产品有想法？让我们知道！</div>
          <div className={s.board}>
            {CUSTOM_PAN_ITEMS.map((item) => (
              <Feature key={item.key} title={item.title} color={COLOR_NAME.PURPLE} />
            ))}
          </div>
          <Link href={`mailto:${EMAIL_SUPPORT}`} className={s.link}>
            <Button ghost>联系我们</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
