defmodule GroupherServer.Test.Helper.Schema.Doc do
  @moduledoc "GraphQL documents used by document tests."

  def m(:update_draft) do
    """
    mutation($community: String!, $id: ID!, $title: String, $subtitle: String, $slug: String, $body: String) {
      updateDocDraft(community: $community, id: $id, title: $title, subtitle: $subtitle, slug: $slug, body: $body) {
        id
        docId
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
          xml
          rss
        }
      }
    }
    """
  end

  def m(:checkpoint_snapshot) do
    """
    mutation($community: String!, $id: ID!) {
      checkpointDocDraftSnapshot(community: $community, id: $id) {
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
        contentHash
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
    mutation($community: String!, $input: DocPublishChangesInput) {
      publishDocChanges(community: $community, input: $input) {
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
    mutation($community: String!, $id: ID!, $snapshotId: ID!) {
      restoreDocDraftSnapshot(community: $community, id: $id, snapshotId: $snapshotId) {
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
          xml
          rss
        }
      }
    }
    """
  end

  def q(:draft_snapshots) do
    """
    query($community: String!, $id: ID!, $stage: ArticleSnapshotStage) {
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
        contentHash
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
