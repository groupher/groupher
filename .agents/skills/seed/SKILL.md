---
name: seed
description: Use pnpm seed to prepare and clean up local development actors, communities, admin permissions, articles, scenarios and home content through the managed application.
---

# Local Development Seed

Use the [seed README](../../../backend/api/dev/seed/README.md) in the checkout under test. It contains the prerequisites, executable examples for all supported actions, and JSON result conventions.

| Task                                                             | Examples                                                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Create or list synthetic actors and create their community       | [Actors and community](../../../backend/api/dev/seed/README.md#账号与社区)                |
| Invite or accept an admin, change permissions or remove a member | [Admin workflow](../../../backend/api/dev/seed/README.md#管理员邀请与权限)                |
| Prepare an owner-bound draft or published Post                   | [Article creation](../../../backend/api/dev/seed/README.md#创建文章)                      |
| Archive a run-owned community, preview cleanup or apply it       | [Archive and cleanup](../../../backend/api/dev/seed/README.md#归档与清理)                 |
| Prepare theme-edit permissions or an admin invitation case       | [Typical test cases](../../../backend/api/dev/seed/README.md#典型测试-case)               |
| Prepare persistent development home content                      | [Home setup](../../../backend/api/dev/seed/README.md#常驻-home)                           |
| Diagnose an article with an unconfirmed dispatch                 | [Recovery and isolated tests](../../../backend/api/dev/seed/README.md#文章恢复与隔离测试) |

For browser sessions, UI actions, co-author grants and commands on older revisions, use the target revision’s [local test actors runbook](../../../docs/auth/local-test-actors.md). For cross-environment login isolation, follow the [same-profile procedure](../grstack/SKILL.md#reproduce-at-the-reported-entry-point). For teardown involving databases, worktrees or runtime handoffs, use the [resource cleanup procedure](../grstack/references/test-cleanup.md).
