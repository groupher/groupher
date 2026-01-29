import ArrowButton from '~/widgets/Buttons/ArrowButton'
import ColorSelector from '~/widgets/ColorSelector'
import { FIELD } from '../constant'
import usePrimaryColor from '../logic/usePrimaryColor'
import SavingBar from '../SavingBar'
import SectionLabel from '../SectionLabel'
import useSalon, { cn } from '../salon/layout/primary_color'

export default () => {
  const s = useSalon()
  const { edit, primaryColor, isTouched, saving } = usePrimaryColor()

  return (
    <section className={s.wrapper}>
      <SectionLabel
        title='弹出层背景色'
        desc={
          <div>
            浅色主题下使用深色弹出层, 仅作用于 Tooltip / Menu / Popover 等轻量弹出层，不影响 Modal /
            Drawer 等页面级组件。参考
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
                placement='right'
                offset={[-1, 15]}
              >
                <div className={s.colorBall} />
              </ColorSelector>
            </div>
            <div className={s.title}>主题颜色</div>
          </div>
          <p className={s.desc}>作用于各类按钮, 标签组件，路由等高亮颜色</p>

          <SavingBar
            isTouched={isTouched}
            field={FIELD.PRIMARY_COLOR}
            loading={saving}
            width='w-11/12'
            top={6}
          />
        </div>

        <div className={s.block}>
          <div className={cn(s.head, s.subHead)}>
            <div className={cn(s.ballWrapper, s.subBall)}>
              <ColorSelector
                activeColor={primaryColor}
                onChange={(color) => edit(color, 'primaryColor')}
                placement='right'
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
        field={FIELD.PRIMARY_COLOR}
        loading={saving}
        width='w-11/12'
        top={6}
      />
    </section>
  )
}
