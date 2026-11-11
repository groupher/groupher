import { describe, expect, it } from 'vitest'

import {
  CONTENT_PUBLISH_ACTION,
  CONTENT_ARTICLE_THREAD,
  CONTENT_PUBLISH_SCOPE,
  CONTENT_SCOPE_BY_ACTION,
  CONTENT_SOURCE_FORMAT,
  CONTENT_TYPE,
  CONTENT_TYPE_BY_ACTION,
  parseContentPublishCommand,
} from './content-publish'

const docCommand = {
  action: CONTENT_PUBLISH_ACTION.UPDATE_DOC_DRAFT,
  target: { community: 'home', documentId: 'doc-1' },
  payload: {
    content: { format: CONTENT_SOURCE_FORMAT.PLATE, value: [{ type: 'p', children: [] }] },
    title: 'Intro',
    subtitle: '',
    slug: 'intro',
  },
  commandId: 'command-1',
  expectedVersion: 3,
}

describe('content publish command parser', () => {
  it('parses an action-specific doc command', () => {
    expect(parseContentPublishCommand(docCommand)).toEqual({ ok: true, value: docCommand })
  })

  it.each([
    [{ ...docCommand, action: 'doc.delete' }, 'action', 'unknown_action'],
    [{ ...docCommand, expectedVersion: -1 }, 'expectedVersion', 'invalid_version'],
    [
      { ...docCommand, payload: { ...docCommand.payload, content: { format: 'html' } } },
      'payload.content.format',
      'unknown_format',
    ],
    [{ ...docCommand, target: { articleId: 'article-1' } }, 'target.community', 'invalid_string'],
  ])('fails closed for invalid commands', (command, path, code) => {
    expect(parseContentPublishCommand(command)).toMatchObject({
      ok: false,
      issues: [{ path, code }],
    })
  })

  it('rejects creating Docs through the Article WorkingCopy command', () => {
    const articleCommand = {
      action: CONTENT_PUBLISH_ACTION.CREATE_ARTICLE,
      target: { community: 'home', thread: 'doc' },
      payload: {
        content: { format: CONTENT_SOURCE_FORMAT.PLATE, value: [] },
        tagIds: [],
      },
      commandId: 'create-doc-1',
    }

    expect(parseContentPublishCommand(articleCommand)).toMatchObject({
      ok: false,
      issues: [{ path: 'target.thread', code: 'unsupported_thread' }],
    })
    expect(CONTENT_ARTICLE_THREAD).toEqual({ POST: 'post', BLOG: 'blog', CHANGELOG: 'changelog' })
  })

  it('maps every action to a content type and capability scope', () => {
    expect(Object.keys(CONTENT_TYPE_BY_ACTION)).toEqual(Object.values(CONTENT_PUBLISH_ACTION))
    expect(CONTENT_TYPE_BY_ACTION[CONTENT_PUBLISH_ACTION.UPDATE_DOC_DRAFT]).toBe(CONTENT_TYPE.DOC)
    expect(CONTENT_SCOPE_BY_ACTION[CONTENT_PUBLISH_ACTION.UPDATE_DOC_DRAFT]).toBe(
      CONTENT_PUBLISH_SCOPE.DOC_WRITE,
    )
  })

  it('requires the WorkingCopy revision and rejects the old expectedVersion field', () => {
    const saveCommand = {
      action: CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY,
      target: { community: 'home', articleId: 'article-1', workingCopyId: 'work-1' },
      payload: {
        content: { format: CONTENT_SOURCE_FORMAT.PLATE, value: [] },
        linkAddr: 'https://example.test/source',
        subtitle: 'Article subtitle',
        templateKey: 'guide',
      },
      commandId: 'save-1',
      revision: 7,
    }

    expect(parseContentPublishCommand(saveCommand)).toEqual({ ok: true, value: saveCommand })
    expect(parseContentPublishCommand({ ...saveCommand, revision: undefined })).toMatchObject({
      ok: false,
      issues: [{ path: 'revision', code: 'invalid_revision' }],
    })
    expect(parseContentPublishCommand({ ...saveCommand, expectedVersion: 7 })).toMatchObject({
      ok: false,
      issues: [{ path: 'expectedVersion', code: 'unsupported_field' }],
    })
    expect(
      parseContentPublishCommand({ ...saveCommand, action: 'article.work.save' }),
    ).toMatchObject({ ok: false, issues: [{ path: 'action', code: 'unknown_action' }] })
  })
})
