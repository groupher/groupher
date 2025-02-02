import { startsWith } from 'ramda'

import { toast } from '~/signal'
import { buildGQClient } from '~/utils/graphql'
import uid from '~/utils/uid'
import BStore from '~/utils/bstore'

import { ASSETS_ENDPOINT } from '~/config'

import type { TTokens } from './spec'
import { STS, OSS_CONFIG } from './constant'
import S from './schema'

// const sessionState = gqClient.request(P.sessionState)
const gqClient = buildGQClient()

export const applyUploadTokensIfNeed = async (): Promise<void> => {
  if (BStore.get(STS.TOKEN) && !isTokenExpired()) return

  const tokens = await applyStsTokens()
  persistTokens(tokens)
}

// see: https://sentry.io/answers/how-to-compare-two-dates-with-javascript/
const isTokenExpired = () => {
  const expirationDate = new Date(BStore.get(STS.EXPIRATION))
  const now = new Date()

  return expirationDate < now
}

const applyStsTokens = async (): Promise<TTokens> => {
  // @ts-ignore
  const { applyUploadTokens } = await gqClient.request(S.applyUploadTokens)

  return { ...applyUploadTokens }
}

const persistTokens = (tokns: TTokens): void => {
  const { accessKeyId, securityToken, accessKeySecret, expiration } = tokns

  BStore.set(STS.TOKEN, securityToken)
  BStore.set(STS.AK, accessKeyId)
  BStore.set(STS.AS, accessKeySecret)
  BStore.set(STS.EXPIRATION, expiration)
}

const getOSSDir = (): string => {
  const curDateTime = new Date()
  const year = curDateTime.getFullYear()
  const month = curDateTime.getMonth() + 1
  const day = curDateTime.getDate()

  return `ugc/_tmp/${year}-${month}-${day}`
}

export const initOSSClient = (): any => {
  applyUploadTokensIfNeed()

  // @ts-ignore
  const ossClient = new OSS({
    /**
     *  从STS服务获取的安全令牌（SecurityToken）, 对应的 policy 在阿里控制台上设置
     */
    accessKeyId: BStore.get(STS.AK),
    accessKeySecret: BStore.get(STS.AS),
    stsToken: BStore.get(STS.TOKEN),
    region: OSS_CONFIG.REGION,
    bucket: OSS_CONFIG.BUCKET,
    refreshSTSToken: async () => {
      const tokens = await applyStsTokens()
      const { accessKeyId, securityToken, accessKeySecret } = tokens
      persistTokens(tokens)

      return {
        accessKeyId,
        accessKeySecret,
        stsToken: securityToken,
      }
    },
    refreshSTSTokenInterval: 300000,
  })

  return ossClient
}

export const handleUploadFile = (ossClient, e, filePrefix, callbacks): void => {
  const { files } = e.target
  const file = files[0]

  doUploadFile(ossClient, file, filePrefix, callbacks)
}

export const doUploadFile = (ossClient, file, filePrefix, callbacks): void => {
  if (!file || !startsWith('image/', file.type)) return

  const fileSize = file.size / 1024 / 1024
  // eslint-disable-next-line no-alert
  if (fileSize > 2) {
    alert('不支持大于 2MB 的文件')
    return
  }

  callbacks.onStart()

  const filename = `${uid.gen()}_${file.name}`
  const fileFullname = filePrefix ? `${filePrefix}_${filename}` : filename
  const OSSDir = getOSSDir()

  const fullpath = `${OSSDir}/${fileFullname}`

  ossClient
    .multipartUpload(fullpath, file)
    .then((result) => {
      const url = `${ASSETS_ENDPOINT}/${result.name}`
      callbacks.onDone(url)
    })
    .catch((_err) => {
      callbacks.onError('上传失败')
      toast('文件上传失败')
      // BStore.remove(STS.AK)
      // BStore.remove(STS.AS)
      // BStore.remove(STS.TOKEN)
      // BStore.remove(STS.EXPIRATION)
    })
}
