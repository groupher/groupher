defmodule GroupherServer.CMS.DocTree.ChangeDetection do
  @moduledoc """
  Change helpers shared by docs tree projections.

  Tree structure changes are event-driven and belong to the Tree footer. Article
  content changes compare the draft Doc and the latest public snapshot:

      snapshot_hash(docs(stage=draft))
                    !=
      article_snapshots(stage=public).content_hash
  """

  alias GroupherServer.CMS.Model.{ArticleSnapshot, Doc}

  @doc """
  Returns whether a draft doc version differs from its public version.

  ## Examples

      iex> ChangeDetection.draft_content_changed?(draft, public_snapshot)
      true
  """
  @spec draft_content_changed?(Doc.t() | nil, ArticleSnapshot.t() | nil) :: boolean()
  def draft_content_changed?(%Doc{} = draft, %ArticleSnapshot{} = public_snapshot) do
    snapshot_hash(draft) != public_snapshot.content_hash
  end

  def draft_content_changed?(%Doc{}, nil), do: true
  def draft_content_changed?(_, _), do: false

  @doc """
  Returns the content hash shape stored by `ArticleSnapshot`.

  The Doc row keeps the raw parsed document hash, while snapshots include
  subtitle in the hash so subtitle-only checkpoints are not deduplicated away.

  ## Examples

      iex> ChangeDetection.snapshot_hash(draft) == public_snapshot.content_hash
      true
  """
  @spec snapshot_hash(Doc.t()) :: String.t()
  def snapshot_hash(%Doc{} = draft) do
    :sha256
    |> :crypto.hash(:erlang.term_to_binary({draft.content_hash, draft.subtitle}))
    |> Base.encode16(case: :lower)
  end
end
