const REGULAR_ICONS = {
  user: '/icons/fa/user.svg',
  image: '/icons/fa/image.svg',
  envelope: '/icons/fa/envelope.svg',
  star: '/icons/fa/star.svg',
  heart: '/icons/fa/heart.svg',
  calendarDays: '/icons/fa/calendar-days.svg',
  circleUser: '/icons/fa/circle-user.svg',
}

export type TRegularIcons = keyof typeof REGULAR_ICONS
export type TFaIconMeta = (typeof REGULAR_ICONS)[keyof typeof REGULAR_ICONS]

export default REGULAR_ICONS
