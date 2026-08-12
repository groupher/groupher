import type { ApplyCategory } from '../../flow/spec'

type Props = { value: ApplyCategory; onChange: (value: ApplyCategory) => void }

export default function TypeStep({ value, onChange }: Props) {
  return (
    <div>
      <h1 className='apply-title'>What are you building?</h1>
      <p className='apply-copy'>Choose the closest community type. You can refine it later.</p>
      <div className='apply-field'>
        <label htmlFor='community-type'>Community type</label>
        <select
          id='community-type'
          value={value}
          onChange={(event) => onChange(event.target.value as ApplyCategory)}
        >
          <option value='PRODUCT'>Product community</option>
          <option value='GAMING'>Gaming community</option>
          <option value='TEACH'>Learning community</option>
          <option value='GROUP'>Interest group</option>
        </select>
      </div>
    </div>
  )
}
