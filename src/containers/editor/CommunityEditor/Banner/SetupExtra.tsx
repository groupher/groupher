import ApplySVG from '~/icons/Apply'

import Input from '~/widgets/Input'
import ArrowButton from '~/widgets/Buttons/ArrowButton'
import CitySelector from '~/widgets/CitySelector'

import { SOURCE_OPTIONS } from '../constant'

import ScaleSelector from './ScaleSelector'
import BlockSelector from './BlockSelector'
import NextStepButton from './NextStepButton'

import useLogic from '../useLogic'
import useSalon from '../styles/banner/setup_extra'

export default () => {
  const s = useSalon()

  const { homepage, city, source, validState, pervStep, nextStep, inputOnChange } = useLogic()
  const { isTitleValid, isDescValid, isLogoValid, submitting } = validState
  const isValid = isTitleValid && isDescValid && isLogoValid

  return (
    <div className={s.wrapper}>
      <div className={s.head}>
        <ApplySVG className={s.applyIcon} />
        <div className={s.introTitle}>更多信息</div>
      </div>

      <div className={s.introdesc}>
        此处相关信息会在社区创建后，同步到该社区的 &quot;关于&quot; 页面
      </div>

      <div className={s.info}>
        <div className={s.label}>官方主页</div>
        <div className="mb-2.5" />
        <Input
          className={s.input}
          value={homepage}
          placeholder="https://"
          onChange={(e) => inputOnChange(e, 'homepage')}
          autoFocus
        />
        <div className="mb-9" />

        <div className={s.label}>团队规模</div>
        <ScaleSelector />
        <div className="mb-10" />

        <div className={s.label}>您（的团队）所在城市是？</div>
        <div className="mb-5" />
        <CitySelector value={city} onChange={(v) => inputOnChange(v, 'city')} />
        <div className="mb-10" />

        <div className={s.label}>您是从哪里知道 Groupher 的？</div>
        <div className="mb-5" />
        <BlockSelector
          options={SOURCE_OPTIONS}
          activeValue={source}
          onChange={(v) => inputOnChange(v, 'source')}
          rounded
        />
        <div className="mb-5" />
        {/* <ExtraInputBox
            value={extraInfo}
            placeholder="其他信息（支持 Markdown）"
            onChange={(e) => inputOnChange(e, 'extraInfo')}
            behavior="textarea"
          /> */}
      </div>
      <div className={s.nextBtn}>
        <ArrowButton leftLayout onClick={pervStep} dimWhenIdle className={s.prevBtn}>
          上一步
        </ArrowButton>
        <div className="mr-6" />
        <NextStepButton onClick={nextStep} disabled={!isValid} text="完 成" loading={submitting} />
      </div>
    </div>
  )
}
