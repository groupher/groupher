import {
  faUser,
  faImage,
  faEnvelope,
  faStar,
  faHeart,
  faCalendarDays,
  faCircleUser,
} from '@fortawesome/free-regular-svg-icons'
import { faMusic, faHeart as faHeartSolid } from '@fortawesome/free-solid-svg-icons'

const REGULAR_ICONS = {
  user: faUser,
  image: faImage,
  envelope: faEnvelope,
  star: faStar,
  heart: faHeart,
  calendarDays: faCalendarDays,
  circleUser: faCircleUser,
}

const SOLID_ICONS = {
  music: faMusic,
  heartSolid: faHeartSolid,
}

const ICONS = {
  ...REGULAR_ICONS,
  ...SOLID_ICONS,
}

export type TRegularIcons = keyof typeof REGULAR_ICONS
export type TSolidIcons = keyof typeof SOLID_ICONS

export default ICONS
