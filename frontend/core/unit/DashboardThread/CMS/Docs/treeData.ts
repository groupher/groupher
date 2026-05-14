// import { ComponentType } from 'react'

export type TTreeItem = {
  id: string
  name: string
  unread?: number
  readOnly: boolean
  children?: TTreeItem[]
  // icon?: ComponentType
}

export const treeData: TTreeItem[] = [
  {
    id: '1',
    name: 'Inbox',
    unread: 1,
    readOnly: true,
  },
  {
    id: '2',
    name: 'Starred',
    unread: 0,
    readOnly: true,
  },
  {
    id: '3',
    name: 'Snoozed',
    unread: 0,
    readOnly: true,
  },
  {
    id: '4',
    name: '已发送',
    unread: 0,
    readOnly: true,
    // icon: icons.MdSend,
  },
  {
    id: '5',
    name: 'Drafts',
    unread: 14,
    readOnly: true,
  },
  {
    id: '6',
    name: 'Spam',
    unread: 54,
    readOnly: true,
  },
  {
    id: '7',
    name: 'Important',
    unread: 0,
    readOnly: true,
  },
  {
    id: '8',
    name: 'Chats',
    unread: 0,
    readOnly: true,
  },
  {
    id: '9',
    name: 'Scheduled',
    unread: 0,
    readOnly: true,
  },
  {
    id: '10',
    name: 'All Mail',
    unread: 0,
    readOnly: true,
    children: [
      {
        id: '10-1',
        name: 'Trash-1',
        unread: 0,
        readOnly: true,
      },
      {
        id: '10-2',
        name: 'Trash-2',
        unread: 0,
        readOnly: true,
      },
    ],
  },
  {
    id: '11',
    name: 'Trash',
    unread: 0,
    readOnly: true,
  },
  {
    id: '12',
    name: '安装指南',
    readOnly: true,
    children: [
      {
        id: '13',
        name: 'Social',
        unread: 946,
        readOnly: false,
      },
      {
        id: '14',
        name: 'Updates',
        unread: 4580,
        readOnly: false,
      },
      {
        id: '15',
        name: 'Forums',
        unread: 312,
        readOnly: false,
        children: [
          {
            id: '15-1',
            name: 'Github',
            readOnly: false,
          },
        ],
      },
      {
        id: '16',
        name: 'Promotions',
        unread: 312,
        readOnly: false,
      },
    ],
  },
]
