import { Combobox } from '@base-ui/react/combobox'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import SIZE from '~/const/size'
import useTrans from '~/hooks/useTrans'
import CloseSVG from '~/icons/CloseLight'
import PlusSVG from '~/icons/Plus'
import Img from '~/Img'
import type { TUserSearchResult } from '~/spec'
import useAccount from '~/stores/account/hooks'
import useCommunity from '~/stores/community/hooks'
import Button from '~/ui/Buttons/Button'
import UserCard from '~/ui/Cards/UserCard'
import ImgFallback from '~/ui/ImgFallback'
import { toast } from '~/ui/Toaster'
import Tooltip from '~/ui/Tooltip'

import useAdmins from '../logic/useAdmins'
import InvitePermissionDrawer from './InvitePermissionDrawer'
import useSalon from './salon/adder'

export default function Adder() {
  const s = useSalon()
  const { t } = useTrans()
  const { searchUsers, addAdmins, grantablePermissions } = useAdmins()
  const { slug } = useCommunity()
  const { accountScope } = useAccount()
  const [inputValue, setInputValue] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<TUserSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [showPermissionDrawer, setShowPermissionDrawer] = useState(false)
  const [permissions, setPermissions] = useState<string[]>([])
  const search = inputValue.trim()
  const candidates = useQuery({
    queryKey: ['admin-invite-candidates', accountScope, slug, search],
    queryFn: () => searchUsers(search),
    enabled: Boolean(accountScope && slug && search && open),
  })
  const selectedLogins = new Set(selectedUsers.map((user) => user.login))
  const visibleUsers = (candidates.data ?? []).filter(
    (user) => user.login && !selectedLogins.has(user.login),
  )

  const resetSearch = (): void => {
    setInputValue('')
    setOpen(false)
  }

  const onAdd = async (): Promise<void> => {
    if (!selectedUsers.length) return

    setAdding(true)
    try {
      await addAdmins(
        selectedUsers,
        Object.fromEntries(permissions.map((permission) => [permission, true])),
      )
      setSelectedUsers([])
      resetSearch()
    } catch (error) {
      toast(String(error), 'error')
    } finally {
      setAdding(false)
    }
  }

  const removeUser = (login?: string): void => {
    setSelectedUsers((users) => users.filter((user) => user.login !== login))
  }

  const loading = candidates.isFetching
  const showResults = open && Boolean(search)
  const compactSelectedUsers = selectedUsers.length > 2
  const addDisabled = selectedUsers.length === 0

  return (
    <div className={s.wrapper}>
      <Combobox.Root
        multiple
        items={visibleUsers}
        filter={null}
        value={selectedUsers}
        isItemEqualToValue={(item, value) => item.login === value.login}
        itemToStringLabel={(user) => user.nickname ?? user.login ?? ''}
        itemToStringValue={(user) => user.login ?? ''}
        inputValue={inputValue}
        open={showResults}
        onOpenChange={setOpen}
        onInputValueChange={(value) => {
          setInputValue(value)
          setOpen(Boolean(value.trim()))
        }}
        onValueChange={(users) => {
          setSelectedUsers(users)
          resetSearch()
        }}
      >
        <div className={s.searchBox}>
          <div className={s.searchFrame}>
            <div className={s.searchField}>
              <Combobox.Input
                aria-label={t('dsb.admin.adder.placeholder')}
                className={s.input}
                placeholder={t('dsb.admin.adder.placeholder')}
              />
            </div>
            {selectedUsers.length ? (
              <div className={s.selectedList}>
                {selectedUsers.map((user) => (
                  <div className={s.selectedUser} key={user.login}>
                    <Tooltip content={<UserCard user={user} />} delay={0} placement='top'>
                      <Img
                        className={s.selectedAvatar}
                        src={user.avatar ?? ''}
                        fallback={<ImgFallback user={user} className={s.selectedAvatar} />}
                        noLazy
                      />
                    </Tooltip>
                    {!compactSelectedUsers ? (
                      <span className={s.selectedName}>{user.nickname}</span>
                    ) : null}
                    <button
                      className={s.removeButton}
                      type='button'
                      aria-label={`Remove ${user.nickname}`}
                      onClick={() => removeUser(user.login)}
                    >
                      <CloseSVG className={s.removeIcon} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {showResults ? (
            <Combobox.List className={s.listBox} aria-label={t('dsb.admin.adder.placeholder')}>
              {loading || visibleUsers.length === 0 ? (
                <div className={s.empty}>
                  {loading ? t('dsb.admin.adder.loading') : t('dsb.admin.adder.empty')}
                </div>
              ) : (
                (user: TUserSearchResult) => (
                  <Combobox.Item key={user.login} value={user} className={s.item}>
                    <div className={s.itemInner}>
                      <div className={s.avatarBox}>
                        <Img
                          className={s.avatar}
                          src={user.avatar ?? ''}
                          fallback={
                            <ImgFallback user={user} className={s.avatar} size={SIZE.MEDIUM} />
                          }
                          noLazy
                        />
                      </div>
                      <div className={s.itemIntro}>
                        <div className={s.itemHeader}>
                          <span className={s.itemName}>{user.nickname}</span>
                          <span className={s.itemLogin}>@{user.login}</span>
                        </div>
                        {user.bio ? <div className={s.itemBio}>{user.bio}</div> : null}
                      </div>
                    </div>
                  </Combobox.Item>
                )
              )}
            </Combobox.List>
          ) : null}
        </div>
      </Combobox.Root>
      <div className='-mt-1.5 ml-4 flex items-center gap-2'>
        <Button ghost onClick={() => setShowPermissionDrawer(true)}>
          {t('dsb.admin.invite.permissions')} · {permissions.length}
        </Button>
        <Button disabled={addDisabled} loading={adding} onClick={onAdd}>
          <PlusSVG className={s.plusIcon} />
          {t('dsb.admin.adder.action')}
        </Button>
      </div>
      <InvitePermissionDrawer
        show={showPermissionDrawer}
        grantablePermissions={grantablePermissions}
        permissions={permissions}
        onChange={(permission, checked) =>
          setPermissions((current) =>
            checked
              ? [...new Set([...current, permission])]
              : current.filter((item) => item !== permission),
          )
        }
        onClose={() => setShowPermissionDrawer(false)}
      />
    </div>
  )
}
