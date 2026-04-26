import { startsWith } from 'ramda'

import { toast } from '~/signal'

export const applyUploadTokensIfNeed = async (): Promise<void> => {
  // OSS STS token endpoint removed from backend
  // This functionality is deprecated
}

export const initOSSClient = (): null => {
  // OSS STS token endpoint removed from backend
  // This functionality is deprecated
  return null
}

export const handleUploadFile = (_ossClient, e, _filePrefix, callbacks): void => {
  const { files } = e.target
  const file = files[0]

  if (!file || !startsWith('image/', file.type)) return

  callbacks.onError('上传功能暂不可用')
  toast('上传功能暂不可用')
}

export const doUploadFile = (_ossClient, file, _filePrefix, callbacks): void => {
  if (!file || !startsWith('image/', file.type)) return

  callbacks.onError('上传功能暂不可用')
  toast('上传功能暂不可用')
}
