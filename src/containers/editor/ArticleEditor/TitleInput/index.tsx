import type { FC } from 'react'

import { Wrapper, Inputer } from '../styles/title_input'

type TProps = {
  title: string
  placeholder: string
}

const TitleInput: FC<TProps> = ({ title, placeholder }) => {
  return (
    <Wrapper>
      <Inputer
        value={title}
        placeholder={placeholder}
        behavior="textarea"
        onChange={(_) => console.log('## TODO')}
        disableEnter
        autoFocus
      />
    </Wrapper>
  )
}

export default TitleInput
