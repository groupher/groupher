defmodule GroupherServer.Test.Helper.Schema.Doc do
  @moduledoc "GraphQL documents used by document tests."

  def m(:update_draft) do
    """
    mutation($community: String!, $id: ID!, $expectedVersion: Int!, $title: String, $subtitle: String, $slug: String, $bodyBag: ArtimentBodyBagInput, $commandId: ID!) {
      updateDocDraft(community: $community, id: $id, expectedVersion: $expectedVersion, title: $title, subtitle: $subtitle, slug: $slug, bodyBag: $bodyBag, commandId: $commandId) {
        id
        docId
        version
        title
        subtitle
        slug
        digest
        insertedAt
        updatedAt
        author {
          login
          nickname
          avatar
        }
        document {
          json
          markdown
          markdownToc
          html
        }
      }
    }
    """
  end

  def m(:checkpoint_snapshot) do
    """
    mutation($community: String!, $id: ID!, $commandId: ID!) {
      checkpointDocDraftSnapshot(community: $community, id: $id, commandId: $commandId) {
        id
        thread
        stage
        action
        articleHashId
        title
        slug
        subtitle
        digest
        documentJson
        versionHash
        revisionNumber
        author {
          login
        }
      }
    }
    """
  end

  def m(:publish_changes) do
    """
    mutation($community: String!, $input: DocPublishChangesInput, $commandId: ID!) {
      publishDocChanges(community: $community, input: $input, commandId: $commandId) {
        done
        release {
          id
          releaseNumber
        }
        scope {
          totalCount
        }
      }
    }
    """
  end

  def m(:restore_snapshot) do
    """
    mutation($community: String!, $id: ID!, $snapshotId: ID!, $commandId: ID!) {
      restoreDocDraftSnapshot(community: $community, id: $id, snapshotId: $snapshotId, commandId: $commandId) {
        id
        title
        subtitle
        slug
        digest
        document {
          json
        }
      }
    }
    """
  end

  def q(:draft) do
    """
    query($community: String!, $id: ID!) {
      docDraft(community: $community, id: $id) {
        id
        docId
        version
        title
        subtitle
        slug
        digest
        insertedAt
        updatedAt
        author {
          login
          nickname
          avatar
        }
        document {
          json
          markdown
          markdownToc
          html
        }
      }
    }
    """
  end

  def q(:draft_snapshots) do
    """
    query($community: String!, $id: ID!, $stage: DocSnapshotStage) {
      docDraftSnapshots(community: $community, id: $id, stage: $stage) {
        id
        thread
        stage
        action
        articleHashId
        title
        slug
        subtitle
        digest
        documentJson
        versionHash
        revisionNumber
        schemaVersion
        insertedAt
        author {
          login
        }
      }
    }
    """
  end
end
