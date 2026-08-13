import { startsWith } from 'ramda'

import { toast } from '~/ui/Toaster'

/** Runs the init ossclient operation at the frontend shared boundary. */
export const initOSSClient = (): null => {
  // OSS STS token endpoint removed from backend
  // This functionality is deprecated
  return null
}

/** Runs the handle upload file operation at the frontend shared boundary. */
export const handleUploadFile = (_ossClient, e, _filePrefix, callbacks): void => {
  const { files } = e.target
  const file = files[0]

  if (!file || !startsWith('image/', file.type)) return

  callbacks.onError('上传功能暂不可用')
  toast('上传功能暂不可用')
}
