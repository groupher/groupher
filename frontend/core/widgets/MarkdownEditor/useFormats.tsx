import { useMemo } from 'react'

import useTrans from '~/hooks/useTrans'

import { FORMAT_CONFIGS } from './constant'
import type { TFormat } from './constant'

export default function useFormats(): TFormat[] {
  const { t } = useTrans()

  return useMemo(() => {
    const meta = {
      heading: t('widgets.markdown_editor.placeholder.heading'),
      bold: t('widgets.markdown_editor.placeholder.bold'),
      italic: t('widgets.markdown_editor.placeholder.italic'),
      quote: t('widgets.markdown_editor.placeholder.quote'),
      code: t('widgets.markdown_editor.placeholder.code'),
      linkText: t('widgets.markdown_editor.placeholder.link_text'),
      listItem: t('widgets.markdown_editor.placeholder.list_item'),
      taskItem: t('widgets.markdown_editor.placeholder.task_item'),
    }

    return FORMAT_CONFIGS.map((format) => ({
      label: format.label,
      hint: t(format.hintKey),
      className: format.className,
      action: (textarea) => format.action(textarea, meta),
    }))
  }, [t])
}
