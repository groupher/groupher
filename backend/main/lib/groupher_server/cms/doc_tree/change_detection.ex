defmodule GroupherServer.CMS.DocTree.ChangeDetection do
  @moduledoc """
  Change helpers shared by docs tree projections.

  Tree structure changes are event-driven and belong to the Tree footer. Article
  content changes compare the draft Doc and the latest public snapshot:

      version_hash(docs(stage=draft))
                    !=
      doc_snapshots(stage=public).version_hash

  Business position:

      Dashboard / public Docs
        -> CMS.DocTree
        -> ChangeDetection
        -> Repo / published projection
  """

  alias GroupherServer.CMS.Docs.Snapshot
  alias GroupherServer.CMS.Model.{Doc, DocSnapshot}

  @doc """
  Returns whether a draft doc version differs from its public version.

  ## Examples

      iex> ChangeDetection.draft_content_changed?(draft, public_snapshot)
      true
  """
  @spec draft_content_changed?(Doc.t() | nil, DocSnapshot.t() | nil) :: boolean()
  def draft_content_changed?(%Doc{} = draft, %DocSnapshot{} = public_snapshot) do
    Snapshot.version_hash(draft) != public_snapshot.version_hash
  end

  def draft_content_changed?(%Doc{}, nil), do: true
  def draft_content_changed?(_, _), do: false

  @doc """
  Returns the complete version hash shape stored by `DocSnapshot`.

  ## Examples

      iex> ChangeDetection.version_hash(draft) == public_snapshot.version_hash
      true
  """
  @spec version_hash(Doc.t()) :: String.t()
  def version_hash(%Doc{} = draft), do: Snapshot.version_hash(draft)
end
