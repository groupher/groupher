import { valueKeyedEnum } from '~/lib/enumValues'
import { EmotionType } from '~/lib/graphql/generated/enums'

const { UPVOTE: _upvote, ...EMOTION } = valueKeyedEnum(EmotionType)

export default EMOTION
