import type { FC } from 'react'

import Input from '~/widgets/Input'

import useSalon from './salon/title_input'

type TProps = {
  title: string
  placeholder: string
}

const TitleInput: FC<TProps> = ({ title, placeholder }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Input
        className={s.inputer}
        value={title}
        placeholder={placeholder}
        behavior="textarea"
        onChange={(_) => console.log('## TODO')}
        disableEnter
        autoFocus
      />
    </div>
  )
}

export default TitleInput
