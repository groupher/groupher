/*
 *
 * SocialEditor
 *
 */

import { type FC, memo, useState, useCallback, useEffect, Fragment } from 'react'
import { keys, includes, reject, findIndex, update } from 'ramda'

import { useAutoAnimate } from '@formkit/auto-animate/react'

import type { TSocialType, TSocialItem, TSpace } from '~/spec'
import { SOCIAL_LIST } from '~/const/social'

import InputBar from './InputBar'

import useSalon, { cn, Icon } from './salon'

type TProps = {
  testid?: string
  width?: string
  withTitle?: boolean
  value?: TSocialItem[]
  onChange?: (items: TSocialItem[]) => void
} & TSpace

const SocialEditor: FC<TProps> = ({
  testid = 'social-editor',
  width = 'w-full',
  withTitle = true,
  onChange = console.log,
  value = [],
  ...spacing
}) => {
  const s = useSalon({ width, ...spacing })
  const [parent] = useAutoAnimate()

  const [selected, setSelected] = useState<TSocialItem[]>([{ type: SOCIAL_LIST.EMAIL, link: '' }])

  useEffect(() => {
    setSelected(value)
  }, [value])

  const removeSocial = useCallback(
    (social: TSocialItem) => {
      const after: TSocialItem[] = reject(
        (item: TSocialItem) => item.type === social.type,
        selected,
      )
      setSelected(after)
      onChange(after)
    },
    [selected, onChange],
  )

  const updateSocial = useCallback(
    (type: string, value: string) => {
      const targetIndex = findIndex((item: TSocialItem) => item.type === type, selected)
      const after = update(targetIndex, { type, link: value }, selected)
      setSelected(after as TSocialItem[])
      onChange(after)
    },
    [selected, onChange],
  )

  return (
    <div className={s.wrapper} data-testid={testid}>
      {withTitle && <div className={s.label}>社交平台账号</div>}

      <div className="mt-2" />
      <div className={s.hint}>
        点击选择社交平台，相关信息会展示在讨论区主页，页脚以及社区关于页面。
      </div>

      <div className={s.platforms}>
        {keys(SOCIAL_LIST).map((social: TSocialType) => {
          const SocialIcon = Icon[social]
          const selectedTypes = selected.map((s) => s.type)
          const active = includes(social, selectedTypes)

          return (
            <div key={social} className={cn(s.iconBox, active && s.iconBoxActive)}>
              <SocialIcon
                className={cn(s.icon, active && s.iconActive, social === 'WEIBO' && 'size-5')}
                onClick={() => {
                  if (!includes(social, selectedTypes)) {
                    setSelected([...selected, { type: social, link: '' }])
                  }
                }}
              />
              {active && <div className={s.iconActiveBar} />}
            </div>
          )
        })}
      </div>

      <div className={s.inputWrapper} ref={parent}>
        {selected.map((item: TSocialItem) => (
          <Fragment key={item.type}>
            <InputBar social={item} onDelete={removeSocial} onChange={updateSocial} />
          </Fragment>
        ))}
      </div>
    </div>
  )
}

export default memo(SocialEditor)
