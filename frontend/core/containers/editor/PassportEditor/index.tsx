/* *
 * PassportEditor
 *
 */

import type { FC } from 'react'

import useCommunity from '~/hooks/useCommunity'
import useMount from '~/hooks/useMount'
import Button from '~/widgets/Buttons/Button'
import Selects from './Selects'
import useSalon from './salon'
import useLogic from './useLogic'

const PassportEditor: FC = () => {
  const s = useSalon()

  const community$ = useCommunity()

  const {
    activeModerator,
    loadAllPassportRules,
    updatePassport,
    isActiveModeratorRoot,
    isCurUserModeratorRoot,
    isReadonly,
  } = useLogic()

  useMount(loadAllPassportRules)

  if (!activeModerator) return null

  return (
    <div className={s.wrapper}>
      {!isActiveModeratorRoot ? <h3>权限设置</h3> : <div className={s.rootSign}>ROOT</div>}
      {isActiveModeratorRoot ? (
        <div className={s.desc}>
          {activeModerator.nickname} 拥有 {community$.title} 社区的所有管理权限
        </div>
      ) : (
        <div className={s.desc}>
          在 {community$.title} 社区范围内，{activeModerator.nickname} 拥有以下权限
        </div>
      )}
      <div className={s.divider} />
      <Selects />
      <div className={s.divider} />

      {!isReadonly && (
        <div className={s.footer}>
          <Button red ghost>
            删除管理员
          </Button>
          <Button onClick={() => updatePassport()}>更新权限</Button>
        </div>
      )}

      {isActiveModeratorRoot && isCurUserModeratorRoot && (
        <div className={s.footer}>
          <Button ghost left={30}>
            转移 ROOT 给其他管理员
          </Button>
        </div>
      )}
    </div>
  )
}

export default PassportEditor
