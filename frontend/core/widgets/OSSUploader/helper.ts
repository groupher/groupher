import { startsWith } from 'ramda'
import { ASSETS_ENDPOINT } from '~/config'
import { toast } from '~/signal'
import persist from '~/utils/persist'
import uid from '~/utils/uid'
import { OSS_CONFIG, STS } from './constant'
import S from './schema'
import type { TTokens } from './spec'

// const sessionState = gqClient.request(P.sessionState)

export const applyUploadTokensIfNeed = async (): Promise<void> => {
  if (persist.get(STS.TOKEN) && !isTokenExpired()) return

  const tokens = await applyStsTokens()
  persistTokens(tokens)
}

// see: https://sentry.io/answers/how-to-compare-two-dates-with-javascript/
const isTokenExpired = () => {
  const expirationDate = new Date(persist.get(STS.EXPIRATION))
  const now = new Date()

  return expirationDate < now
}

const applyStsTokens = async (): Promise<TTokens> => {
  // @ts-expect-error
  const { applyUploadTokens } = await gqClient.request(S.applyUploadTokens)

  return { ...applyUploadTokens }
}

const persistTokens = (tokns: TTokens): void => {
  const { accessKeyId, securityToken, accessKeySecret, expiration } = tokns

  persist.set(STS.TOKEN, securityToken)
  persist.set(STS.AK, accessKeyId)
  persist.set(STS.AS, accessKeySecret)
  persist.set(STS.EXPIRATION, expiration)
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

  // @ts-expect-error
  const ossClient = new OSS({
    /**
     *  从STS服务获取的安全令牌（SecurityToken）, 对应的 policy 在阿里控制台上设置
     */
    accessKeyId: persist.get(STS.AK),
    accessKeySecret: persist.get(STS.AS),
    stsToken: persist.get(STS.TOKEN),
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
      // persist.remove(STS.AK)
      // persist.remove(STS.AS)
      // persist.remove(STS.TOKEN)
      // persist.remove(STS.EXPIRATION)
    })
}
