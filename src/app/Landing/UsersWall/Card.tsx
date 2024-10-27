import type { FC, ReactNode } from 'react'

import type { TColorName, TUser } from '~/spec'

import { Wrapper, Header, Avatar, User, Nickname, Content } from '../salon/users_wall/card'

type TProps = {
  content: ReactNode
  color: TColorName
  user: TUser
}

const Card: FC<TProps> = ({ content, user, color }) => {
  return (
    <Wrapper>
      <Header>
        <Avatar src={user.avatar} color={color} />
        <User>
          <Nickname>{user.nickname}</Nickname>
        </User>
      </Header>
      <Content>{content}</Content>
    </Wrapper>
  )
}

export default Card
