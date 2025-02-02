import ColorSelector from '~/widgets/ColorSelector'
import ArrowButton from '~/widgets/Buttons/ArrowButton'
import Checker from '~/widgets/Checker'

import SectionLabel from '../SectionLabel'
import SavingBar from '../SavingBar'

import { SETTING_FIELD } from '../constant'

import usePrimaryColor from '../logic/usePrimaryColor'
import useSalon, { cn } from '../salon/layout/primary_color'

export default () => {
  const s = useSalon()
  const { edit, primaryColor, getIsTouched, saving } = usePrimaryColor()
  const isTouched = getIsTouched()

  return (
    <section className={s.wrapper}>
      <SectionLabel
        title="主题色"
        desc={
          <div className="row">
            设置后会在常见组件，功能性文字等位置显示该个性化主题色。参考
            <ArrowButton left={1}>影响范围</ArrowButton>
          </div>
        }
      />
      <div className={s.content}>
        <div className={s.block}>
          <div className={s.head}>
            <div className={s.ballWrapper}>
              <ColorSelector
                activeColor={primaryColor}
                onChange={(color) => edit(color, 'primaryColor')}
                placement="right"
                offset={[-1, 15]}
              >
                <div className={s.colorBall} />
              </ColorSelector>
            </div>
            <div className={s.title}>主题颜色</div>
          </div>
          <p className={s.desc}>作用于各类按钮, 标签组件，路由等高亮颜色</p>
          <Checker checked size="small" top={6} left={2}>
            与副主题色同步
          </Checker>

          <SavingBar
            isTouched={isTouched}
            field={SETTING_FIELD.PRIMARY_COLOR}
            loading={saving}
            width="w-11/12"
            top={6}
          />
        </div>

        <div className={s.block}>
          <div className={cn(s.head, s.subHead)}>
            <div className={cn(s.ballWrapper, s.subBall)}>
              <ColorSelector
                activeColor={primaryColor}
                onChange={(color) => edit(color, 'primaryColor')}
                placement="right"
                offset={[-1, 15]}
              >
                <div className={cn(s.colorBall, s.subColorBall)} />
              </ColorSelector>
            </div>
            <div className={s.title}>副主题颜色</div>
          </div>
          <p className={s.desc}>未读提示，链接按钮，各类选择器具， 富文本链接等颜色</p>
        </div>
      </div>

      <SavingBar
        isTouched={isTouched}
        field={SETTING_FIELD.PRIMARY_COLOR}
        loading={saving}
        width="w-11/12"
        top={6}
      />
    </section>
  )
}
