import { useEffect, useMemo, useRef, useState } from 'react'
import { Autocomplete, Input, ListBox, ListBoxItem, SearchField } from 'react-aria-components'
import { useAsyncList } from 'react-stately'

import SIZE from '~/const/size'
import useTrans from '~/hooks/useTrans'
import CloseSVG from '~/icons/CloseLight'
import PlusSVG from '~/icons/Plus'
import Img from '~/Img'
import { toast } from '~/signal'
import type { TUser } from '~/spec'
import Button from '~/widgets/Buttons/Button'
import UserCard from '~/widgets/Cards/UserCard'
import ImgFallback from '~/widgets/ImgFallback'
import Tooltip from '~/widgets/Tooltip'

import useAdmins from '../logic/useAdmins'
import useSalon from '../salon/admin/adder'

export default function Adder() {
  const s = useSalon()
  const { t } = useTrans()
  const { searchUsers, addAdmins, isModerator } = useAdmins()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [selectedUsers, setSelectedUsers] = useState<TUser[]>([])
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const list = useAsyncList<TUser>({
    async load({ filterText }) {
      return { items: await searchUsers(filterText ?? '') }
    },
  })

  useEffect(() => {
    const closeOnOutside = (event: MouseEvent): void => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', closeOnOutside)
    return () => document.removeEventListener('mousedown', closeOnOutside)
  }, [])

  const selectedLogins = useMemo(() => {
    return new Set(selectedUsers.map((user) => user.login))
  }, [selectedUsers])

  const visibleUsers = useMemo(() => {
    return list.items.filter(
      (user) => user.login && !selectedLogins.has(user.login) && !isModerator(user),
    )
  }, [isModerator, list.items, selectedLogins])

  const onInputChange = (value: string): void => {
    list.setFilterText(value)
    setOpen(Boolean(value.trim()))
  }

  const onAdd = async (): Promise<void> => {
    if (!selectedUsers.length) return

    setAdding(true)
    try {
      await addAdmins(selectedUsers)
      setSelectedUsers([])
      list.setFilterText('')
      setOpen(false)
    } catch (error) {
      toast(String(error), 'error')
    } finally {
      setAdding(false)
    }
  }

  const selectUser = (user: TUser): void => {
    if (!user.login || selectedLogins.has(user.login) || isModerator(user)) return

    setSelectedUsers((users) => [...users, user])
    list.setFilterText('')
    setOpen(false)
  }

  const removeUser = (login?: string): void => {
    setSelectedUsers((users) => users.filter((user) => user.login !== login))
  }

  const loading = list.loadingState === 'loading' || list.loadingState === 'filtering'
  const showResults = open && Boolean(list.filterText.trim())
  const compactSelectedUsers = selectedUsers.length > 2
  const addDisabled = selectedUsers.length === 0

  return (
    <div className={s.wrapper} ref={wrapperRef}>
      <Autocomplete inputValue={list.filterText} onInputChange={onInputChange}>
        <div className={s.searchBox}>
          <div className={s.searchFrame}>
            <SearchField aria-label={t('dsb.admin.adder.placeholder')} className={s.searchField}>
              <Input
                className={s.input}
                placeholder={t('dsb.admin.adder.placeholder')}
                onFocus={() => setOpen(Boolean(list.filterText.trim()))}
              />
            </SearchField>
            {selectedUsers.length ? (
              <div className={s.selectedList}>
                {selectedUsers.map((user) => (
                  <div className={s.selectedUser} key={user.login}>
                    <Tooltip content={<UserCard user={user} />} delay={0} placement='top'>
                      <Img
                        className={s.selectedAvatar}
                        src={user.avatar}
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
            <ListBox
              className={s.listBox}
              items={visibleUsers}
              renderEmptyState={() => (
                <div className={s.empty}>
                  {loading ? t('dsb.admin.adder.loading') : t('dsb.admin.adder.empty')}
                </div>
              )}
            >
              {(user) => (
                <ListBoxItem
                  id={user.login}
                  textValue={`${user.nickname} ${user.login}`}
                  className={s.item}
                  onAction={() => selectUser(user)}
                >
                  <div className={s.itemInner}>
                    <div className={s.avatarBox}>
                      <Img
                        className={s.avatar}
                        src={user.avatar}
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
                </ListBoxItem>
              )}
            </ListBox>
          ) : null}
        </div>
      </Autocomplete>
      <Button className={s.addBtn} disabled={addDisabled} loading={adding} onClick={onAdd}>
        <PlusSVG className={s.plusIcon} />
        {t('dsb.admin.adder.action')}
      </Button>
    </div>
  )
}
