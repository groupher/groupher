import { useState } from 'react'

import { uploadApplicationLogo } from '../../lib/logo-upload'

type Props = {
  logoUrl: string
  onUploaded: (ref: string, url: string) => void
}

export default function LogoStep({ logoUrl, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <h1 className='apply-title'>Add a Logo</h1>
      <p className='apply-copy'>PNG, JPEG, WebP or GIF up to 10 MB.</p>
      {logoUrl ? <img src={logoUrl} alt='Community Logo preview' width={96} height={96} /> : null}
      <div className='apply-field'>
        <label htmlFor='community-logo'>Logo file</label>
        <input
          id='community-logo'
          type='file'
          accept='image/png,image/jpeg,image/webp,image/gif'
          disabled={uploading}
          onChange={async (event) => {
            const file = event.target.files?.[0]
            if (!file) return
            setUploading(true)
            setError(null)
            try {
              const uploaded = await uploadApplicationLogo(file)
              onUploaded(uploaded.ref, uploaded.url)
            } catch (uploadError) {
              setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.')
            } finally {
              setUploading(false)
            }
          }}
        />
      </div>
      {uploading ? <p className='apply-copy'>Uploading and verifying…</p> : null}
      {error ? <p className='apply-error'>{error}</p> : null}
    </div>
  )
}
