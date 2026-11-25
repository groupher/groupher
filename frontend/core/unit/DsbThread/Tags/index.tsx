import TagsEditorProvider from './store/provider'
import TagsEditorContent from './TagsEditorContent'

export default function Tags() {
  return (
    <TagsEditorProvider>
      <TagsEditorContent />
    </TagsEditorProvider>
  )
}
