defmodule GroupherServer.CMS.DocTree.ChangeDetection do
  @moduledoc """
  Change helpers shared by docs tree projections.

  Tree structure changes are event-driven and belong to the Tree footer. Article
  content changes compare the draft workspace and the latest public snapshot:

      snapshot_hash(article_workspaces(stage=draft))
                    !=
      article_snapshots(stage=public).content_hash
  """

  alias GroupherServer.CMS.Model.{ArticleSnapshot, ArticleWorkspace}

  @doc """
  Returns whether a draft article version differs from its public version.

  ## Examples

      iex> ChangeDetection.draft_content_changed?(draft, public_snapshot)
      true
  """
  @spec draft_content_changed?(ArticleWorkspace.t() | nil, ArticleSnapshot.t() | nil) :: boolean()
  def draft_content_changed?(%ArticleWorkspace{} = draft, %ArticleSnapshot{} = public_snapshot) do
    snapshot_hash(draft) != public_snapshot.content_hash
  end

  def draft_content_changed?(%ArticleWorkspace{}, nil), do: true
  def draft_content_changed?(_, _), do: false

  @doc """
  Returns the content hash shape stored by `ArticleSnapshot`.

  The workspace row keeps the raw parsed document hash, while snapshots include
  subtitle in the hash so subtitle-only checkpoints are not deduplicated away.

  ## Examples

      iex> ChangeDetection.snapshot_hash(draft) == public_snapshot.content_hash
      true
  """
  @spec snapshot_hash(ArticleWorkspace.t()) :: String.t()
  def snapshot_hash(%ArticleWorkspace{} = draft) do
    :sha256
    |> :crypto.hash(:erlang.term_to_binary({draft.content_hash, draft.subtitle}))
    |> Base.encode16(case: :lower)
  end
end
