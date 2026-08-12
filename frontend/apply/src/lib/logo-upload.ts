import { clientGraphQL } from './graphql'

type UploadIntent = {
  uploadRef: string
  capability: string
  canonicalUrl: string
}

const assetsHubEndpoint = () =>
  window.location.hostname.endsWith('groupher.com')
    ? 'https://assets-hub.groupher.com'
    : 'https://assets-hub.groupher.localhost'

export const uploadApplicationLogo = async (file: File): Promise<{ ref: string; url: string }> => {
  const result = await clientGraphQL<{
    createCommunityApplicationLogoUploadIntent: UploadIntent
  }>(
    `mutation ApplicationLogoIntent($input: ApplicationLogoUploadInput!) {
      createCommunityApplicationLogoUploadIntent(input: $input) {
        uploadRef capability canonicalUrl
      }
    }`,
    { input: { fileName: file.name, mimeType: file.type, sizeBytes: file.size } },
  )
  const intent = result.createCommunityApplicationLogoUploadIntent
  const uploadResponse = await fetch(`${assetsHubEndpoint()}/uploads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ capability: intent.capability }),
  })
  const uploadPayload = (await uploadResponse.json()) as {
    result?: { upload?: { headers: Record<string, string>; method: string; url: string } }
    error?: { message?: string }
  }
  const upload = uploadPayload.result?.upload
  if (!uploadResponse.ok || !upload)
    throw new Error(uploadPayload.error?.message || 'Upload failed.')
  const objectResponse = await fetch(upload.url, {
    method: upload.method,
    headers: upload.headers,
    body: file,
  })
  if (!objectResponse.ok) throw new Error('Object storage rejected the Logo upload.')
  const finalizeResponse = await fetch(
    `${assetsHubEndpoint()}/uploads/${encodeURIComponent(intent.uploadRef)}/finalize`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ capability: intent.capability }),
    },
  )
  if (!finalizeResponse.ok) throw new Error('Logo upload could not be finalized.')
  return { ref: intent.uploadRef, url: intent.canonicalUrl }
}
