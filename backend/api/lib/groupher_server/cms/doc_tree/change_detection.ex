defmodule GroupherServer.CMS.DocTree.ChangeDetection do
  @moduledoc """
  Change helpers shared by docs tree projections.

  Tree structure changes are event-driven and belong to the Tree footer. Article
  content changes compare the mutable Doc Draft and selected public Revision:

      doc_drafts.content_hash
                    !=
      article_revisions.content_hash

  Business position:

      Dashboard / public Docs
        -> CMS.DocTree
        -> ChangeDetection
        -> Repo / published projection
  """

  alias GroupherServer.CMS.Model.{ArticleRevision, DocDraft}

  @doc """
  Returns whether a draft doc version differs from its public version.

  ## Examples

      iex> ChangeDetection.draft_content_changed?(draft, public_revision)
      true
  """
  @spec draft_content_changed?(DocDraft.t() | nil, ArticleRevision.t() | nil) :: boolean()
  def draft_content_changed?(%DocDraft{} = draft, %ArticleRevision{} = public_revision) do
    draft.content_hash != public_revision.content_hash
  end

  def draft_content_changed?(%DocDraft{}, nil), do: true
  def draft_content_changed?(_, _), do: false

  @doc """
  Returns the canonical content fingerprint persisted by the Draft.

  ## Examples

      iex> ChangeDetection.version_hash(draft) == public_revision.content_hash
      true
  """
  @spec version_hash(DocDraft.t()) :: String.t()
  def version_hash(%DocDraft{} = draft), do: draft.content_hash
end
