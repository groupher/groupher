import { describe, expect, it } from 'vitest'

import {
  CONTENT_PUBLISH_ACTION,
  CONTENT_ARTICLE_THREAD,
  CONTENT_HISTORY_ORIGIN_SCOPE,
  CONTENT_HISTORY_ORIGIN_SCOPE_BY_ACTION,
  CONTENT_PUBLISH_SCOPE,
  CONTENT_SCOPE_BY_ACTION,
  CONTENT_SOURCE_FORMAT,
  CONTENT_TYPE,
  CONTENT_TYPE_BY_ACTION,
  parseContentPublishCommand,
} from './content-publish'

const docCommand = {
  action: CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY,
  target: { community: 'home', articleId: 'doc-1', workingCopyId: 'work-1' },
  payload: {
    content: { format: CONTENT_SOURCE_FORMAT.PLATE, value: [{ type: 'p', children: [] }] },
    title: 'Intro',
    subtitle: '',
    slug: 'intro',
  },
  commandId: 'command-1',
  revision: 3,
}

describe('content publish command parser', () => {
  it('parses an action-specific doc command', () => {
    expect(parseContentPublishCommand(docCommand)).toEqual({ ok: true, value: docCommand })
  })

  it.each([
    [{ ...docCommand, action: 'doc.delete' }, 'action', 'unknown_action'],
    [{ ...docCommand, revision: -1 }, 'revision', 'invalid_revision'],
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

  it('rejects the retired Doc Draft action', () => {
    expect(parseContentPublishCommand({ ...docCommand, action: 'docDraft.update' })).toMatchObject({
      ok: false,
      issues: [{ path: 'action', code: 'unknown_action' }],
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

  it('preserves and validates Article metadata in create-and-publish commands', () => {
    const command = {
      action: CONTENT_PUBLISH_ACTION.CREATE_AND_PUBLISH_ARTICLE,
      target: { community: 'home', thread: 'post' },
      payload: {
        content: { format: CONTENT_SOURCE_FORMAT.PLATE, value: [] },
        title: 'Published Article',
        tagIds: ['tag-1'],
        copyRight: 'Copyright owner',
        linkAddr: 'https://example.test/source',
        subtitle: 'Subtitle',
        templateKey: 'guide',
        coverUrl: 'https://example.test/cover.png',
        coverUrlDark: 'https://example.test/cover-dark.png',
      },
      commandId: 'create-and-publish-1',
    }

    expect(parseContentPublishCommand(command)).toMatchObject({
      ok: true,
      value: { payload: command.payload },
    })
    expect(
      parseContentPublishCommand({
        ...command,
        payload: { ...command.payload, coverUrl: 123 },
      }),
    ).toMatchObject({ ok: false, issues: [{ path: 'payload.coverUrl', code: 'invalid_string' }] })
  })

  it('maps every action to a content type and capability scope', () => {
    expect(Object.keys(CONTENT_TYPE_BY_ACTION)).toEqual(Object.values(CONTENT_PUBLISH_ACTION))
    expect(CONTENT_TYPE_BY_ACTION[CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY]).toBe(
      CONTENT_TYPE.ARTICLE,
    )
    expect(CONTENT_SCOPE_BY_ACTION[CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY]).toBe(
      CONTENT_PUBLISH_SCOPE.ARTICLE_WRITE,
    )
    expect(CONTENT_HISTORY_ORIGIN_SCOPE_BY_ACTION).toEqual({
      [CONTENT_PUBLISH_ACTION.CREATE_ARTICLE]: CONTENT_HISTORY_ORIGIN_SCOPE.BROWSER,
      [CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY]: CONTENT_HISTORY_ORIGIN_SCOPE.BROWSER,
      [CONTENT_PUBLISH_ACTION.CREATE_AND_PUBLISH_ARTICLE]: CONTENT_HISTORY_ORIGIN_SCOPE.BROWSER,
    })
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

  it('requires both Queue and queued-copy revisions for a Docs save', () => {
    const command = {
      action: CONTENT_PUBLISH_ACTION.SAVE_DOC_QUEUE_COPY,
      target: { community: 'home', articleId: 'doc' },
      payload: {
        content: { format: CONTENT_SOURCE_FORMAT.PLATE, value: [] },
        title: 'Doc',
        subtitle: '',
        slug: 'doc',
      },
      commandId: 'save-queue',
      revision: 3,
      queueRevision: 2,
    }
    expect(parseContentPublishCommand(command)).toEqual({ ok: true, value: command })
    expect(parseContentPublishCommand({ ...command, queueRevision: -1 })).toMatchObject({
      ok: false,
      issues: [{ path: 'queueRevision' }],
    })
    expect(parseContentPublishCommand({ ...command, revision: 0 })).toMatchObject({
      ok: false,
      issues: [{ path: 'revision' }],
    })
  })
})
