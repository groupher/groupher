type Props = {
  desc: string
  message: string
  onDescChange: (value: string) => void
  onMessageChange: (value: string) => void
}

export default function StoryStep({ desc, message, onDescChange, onMessageChange }: Props) {
  return (
    <div>
      <h1 className='apply-title'>Tell us about it</h1>
      <p className='apply-copy'>A clear description helps us review the application.</p>
      <div className='apply-field'>
        <label htmlFor='community-desc'>Community description</label>
        <textarea
          id='community-desc'
          rows={5}
          maxLength={800}
          value={desc}
          onChange={(event) => onDescChange(event.target.value)}
        />
      </div>
      <div className='apply-field'>
        <label htmlFor='application-message'>Anything else? (optional)</label>
        <textarea
          id='application-message'
          rows={3}
          maxLength={1000}
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
        />
      </div>
    </div>
  )
}
