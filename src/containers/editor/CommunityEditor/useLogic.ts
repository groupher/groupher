import { proxy, useSnapshot } from 'valtio'
import { pick, isEmpty, keys, mergeDeepRight } from 'ramda'

import type { TEditValue } from '~/spec'
import { query, mutate } from '~/server'

import type {
  TStore,
  THeaderStatus,
  TSelectTypeStatus,
  TSetupDomainStatus,
  TSetupInfoStatus,
  TSetupExtraStatus,
  TFinishedStatus,
  TValidState,
  TCommunityType,
} from './spec'
import { STEP } from './constant'

import S from './schema'

type TRet = {
  checkPendingApply: () => void
  communityTypeOnChange: (communityType: TCommunityType) => void
  isOfficalOnChange: (isOfficalValid: boolean) => void
  applyCommunity: () => void
  pervStep: () => void
  nextStep: () => void
  inputOnChange: (e: TEditValue, part: string) => void
} & TStore

const store = proxy<TStore>({
  count: 10,
  // step: STEP.SELECT_TYPE,
  step: STEP.SETUP_INFO,
  communityType: null,

  checking: false,
  submitting: false,
  isOfficalValid: false,

  communityExist: false,
  hasPendingApply: false,

  //
  slug: '',
  logo: null,
  title: '',
  homepage: '',
  extraInfo: '',

  city: '',
  source: '',

  desc: '',

  get applyMsg(): string {
    const { homepage, extraInfo } = store

    return `${homepage}\n${extraInfo}`
  },

  get headerStatus(): THeaderStatus {
    const { step, communityType } = store

    return {
      step,
      communityType,
      showStep: communityType !== null,
    }
  },

  get selectTypeStatus(): TSelectTypeStatus {
    const { communityType } = store

    return { communityType }
  },
  get setupDomainStatus(): TSetupDomainStatus {
    return pick(['slug', 'communityType'], store)
  },
  get setupInfoStatus(): TSetupInfoStatus {
    return pick(['slug', 'title', 'desc', 'logo', 'communityType'], store)
  },
  get setupExtraStatus(): TSetupExtraStatus {
    return pick(['homepage', 'extraInfo', 'city', 'source', 'communityType'], store)
  },
  get finishedStatus(): TFinishedStatus {
    return pick(['slug', 'title', 'desc', 'logo'], store)
  },
  get isCommunityTypeValid(): boolean {
    return true
  },
  get isRawValid(): boolean {
    if (store.communityExist) return false

    const rule = /^[0-9a-zA-Z-_]+$/
    return rule.test(store.slug)
  },
  get isTitleValid(): boolean {
    return !isEmpty(store.slug)
  },
  get isDescValid(): boolean {
    return !isEmpty(store.desc)
  },
  get isLogoValid(): boolean {
    // return store.logo && !isEmpty(store.logo)
    return true
  },
  get validState(): TValidState {
    return pick(
      [
        'isOfficalValid',
        'isCommunityTypeValid',
        'isRawValid',
        'isTitleValid',
        'isDescValid',
        'isLogoValid',
        'checking',
        'communityExist',
        'hasPendingApply',
        'submitting',
      ],
      store,
    )
  },

  commit: (patch: Partial<TStore>): void => {
    Object.assign(store, mergeDeepRight(store, patch))
  },
})

export default (): TRet => {
  const snap = useSnapshot(store)

  const checkPendingApply = () => {
    query(S.hasPendingCommunityApply, {}).then(({ hasPendingCommunityApply }) => {
      snap.commit({ hasPendingApply: hasPendingCommunityApply.exist })
    })
  }

  const checkIfCommunityExist = () => {
    const { slug } = snap

    snap.commit({ checking: true, communityExist: false })
    query(S.isCommunityExist, { slug }).then(({ isCommunityExist }) => {
      snap.commit({ checking: false, communityExist: isCommunityExist.exist })

      if (!isCommunityExist.exist) {
        snap.commit({ step: STEP.SETUP_INFO })
      }
    })
  }

  const pervStep = (): void => {
    const { step } = snap

    if (step === STEP.SETUP_DOMAIN) snap.commit({ step: STEP.SELECT_TYPE })
    if (step === STEP.SETUP_INFO) snap.commit({ step: STEP.SETUP_DOMAIN })
    if (step === STEP.SETUP_EXTRA) snap.commit({ step: STEP.SETUP_INFO })
  }

  const nextStep = (): void => {
    const { step } = snap

    if (step === STEP.SELECT_TYPE) snap.commit({ step: STEP.SETUP_DOMAIN })
    if (step === STEP.SETUP_DOMAIN) {
      checkIfCommunityExist()
    }
    if (step === STEP.SETUP_INFO) {
      snap.commit({ step: STEP.SETUP_EXTRA })
    }
    if (step === STEP.SETUP_EXTRA) {
      applyCommunity()
    }
  }

  /**
   * change the type of the creating community
   * 改变创建社区类型
   * @public
   */
  const communityTypeOnChange = (communityType: TCommunityType): void => {
    snap.commit({ communityType })
  }

  const isOfficalOnChange = (isOfficalValid: boolean): void => snap.commit({ isOfficalValid })

  const applyCommunity = (): void => {
    const params = {
      ...pick(['title', 'logo', 'desc', 'slug', 'applyMsg'], snap),
      applyCategory: snap.communityType,
      logo: 'https://assets.groupher.com/communities/groupher-alpha.png',
    }

    snap.commit({ submitting: true })
    mutate(S.applyCommunity, params).then(({ applyCommunity }) => {
      const { slug, title, desc, logo } = applyCommunity
      snap.commit({ step: STEP.FINISHED, submitting: false, slug, title, desc, logo })
    })
  }

  const inputOnChange = (e: TEditValue, part: string): void => {
    if (part === 'slug') {
      snap.commit({ communityExist: false })
    }

    // @ts-ignore
    snap.commit({ [part]: e?.target.value || '' })
  }

  return {
    ...pick(keys(snap), snap),
    checkPendingApply,
    pervStep,
    nextStep,
    communityTypeOnChange,
    isOfficalOnChange,
    applyCommunity,
    inputOnChange,
  }
}
