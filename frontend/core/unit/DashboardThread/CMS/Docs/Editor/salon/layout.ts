// Shared visual rhythm for the docs editor top action row.
// The -mt-0.5 compensates for the dashboard sub-route item padding so the
// submenu item, tree toolbar, and article action line align visually.
export const DOC_EDITOR_TOP_ROW = 'h-7 -mt-0.5 mb-2'

export const DOC_EDITOR_TOP_ROW_CONTROL = 'h-6'

// Keep room for the sticky snackbar and document footer controls near the
// viewport bottom without letting them cover the editable content.
export const DOC_EDITOR_CONTENT_BOTTOM_RESERVE = 'pb-44'

// Position the snackbar in the document panel, above the lower editor controls.
export const DOC_EDITOR_SNACKBAR_STICKY_TOP = 'calc(100dvh - 7rem)'
