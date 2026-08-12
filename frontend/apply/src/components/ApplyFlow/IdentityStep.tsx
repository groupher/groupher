type Props = {
  slug: string
  title: string
  onSlugChange: (value: string) => void
  onTitleChange: (value: string) => void
}

export default function IdentityStep({ slug, title, onSlugChange, onTitleChange }: Props) {
  return (
    <div>
      <h1 className='apply-title'>Name your community</h1>
      <p className='apply-copy'>The address is reviewed and reserved when you submit.</p>
      <div className='apply-field'>
        <label htmlFor='community-title'>Display name</label>
        <input
          id='community-title'
          value={title}
          maxLength={80}
          onChange={(event) => onTitleChange(event.target.value)}
        />
      </div>
      <div className='apply-field'>
        <label htmlFor='community-slug'>Address</label>
        <input
          id='community-slug'
          value={slug}
          maxLength={48}
          placeholder='your-community'
          onChange={(event) =>
            onSlugChange(
              event.target.value
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '')
                .replace(/--+/g, '-'),
            )
          }
        />
      </div>
    </div>
  )
}
