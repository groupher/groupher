defmodule GroupherServer.CMS.Docs.Store do
  @moduledoc """
  Named persistence reads for Docs projection and release rows.

  The public CMS FrontDesk owns resource visibility; this Query is for
  Docs-owned materialization and command replay facts.

  Business position:

      Docs projection / command replay
        -> Docs.Store named fact
        -> stable branch, revision, body, or release row
  """

  alias GroupherServer.CMS.Model.{
    ArticleBodyDraft,
    ArticleBodySnapshot,
    ArticleRevision,
    Author,
    DocBranch,
    DocBranchVersion,
    DocPublic,
    DocRevision,
    DocPublishRelease
  }

  alias Helper.ORM

  @doc "Loads one Doc public row for a branch."
  def public(article_id, branch_id, opts \\ []) do
    ORM.find_by(DocPublic, Keyword.merge([article_id: article_id, branch_id: branch_id], opts))
  end

  @doc "Loads one durable Doc branch version."
  def branch_version(id), do: ORM.find(DocBranchVersion, id)

  @doc "Loads one Article revision used by a Doc projection."
  def revision(id), do: ORM.find(ArticleRevision, id)

  @doc "Loads one Doc revision extension."
  def revision_extension(revision_id), do: ORM.find_by(DocRevision, revision_id: revision_id)

  @doc "Loads one immutable Article body snapshot."
  def body_snapshot(id), do: ORM.find(ArticleBodySnapshot, id)

  @doc "Loads one mutable Article body draft."
  def body_draft(id), do: ORM.find(ArticleBodyDraft, id)

  @doc "Loads one Author with its User projection."
  def author(id), do: ORM.find(Author, id, preload: :user)

  @doc "Loads one Docs publish release."
  def publish_release(id), do: ORM.find(DocPublishRelease, id)

  @doc "Loads one Community-scoped Docs branch by type."
  def branch(community_id, type) do
    ORM.find_by(DocBranch, community_id: community_id, type: type)
  end
end
