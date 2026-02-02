import ColorSelector from '~/widgets/ColorSelector'
import { FIELD } from '../constant'
import usePrimaryColor from '../logic/usePrimaryColor'
import SavingBar from '../SavingBar'
import SectionLabel from '../SectionLabel'
import useSalon, { cn, cnMerge } from '../salon/layout/primary_color'

export default () => {
  const s = useSalon()
  const { edit, primaryColor, isTouched, saving } = usePrimaryColor()

  return (
    <section>
      <SectionLabel
        title='主题色'
        desc='设置后会在常见组件，功能性文字等位置显示该个性化主题色。参考'
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
          <p className={s.desc}>作用于各类功能按钮，Tab 高亮，菜单高亮等品牌颜色。</p>

          <SavingBar isTouched={isTouched} field={FIELD.PRIMARY_COLOR} loading={saving} top={6} />
        </div>

        <div className={s.block}>
          <div className={cn(s.head, s.subHead)}>
            <div className={cnMerge(s.ballWrapper, s.subBall)}>
              <ColorSelector
                activeColor={primaryColor}
                onChange={(color) => edit(color, 'primaryColor')}
                placement='right'
                offset={[-1, 15]}
              >
                <div className={cnMerge(s.colorBall, s.subColorBall)} />
              </ColorSelector>
            </div>
            <div className={s.title}>强调色</div>
          </div>
          <p className={s.desc}>未读提示，超链接，身份等级，状态标签等颜色</p>
        </div>
      </div>

      <SavingBar isTouched={isTouched} field={FIELD.PRIMARY_COLOR} loading={saving} top={6} />
    </section>
  )
}
