defmodule GroupherServer.CMS.Model.DocsReleaseArticle do
  @moduledoc """
  A published Snapshot or deleted Doc recorded in a sealed Release.

      Release + Article -> publish Snapshot or delete action
  """

  use Ecto.Schema
  import Ecto.Changeset
  alias Helper.Constant.DBPrefix
  @primary_key false
  @schema_prefix DBPrefix.cms()

  schema "doc_publish_release_articles" do
    field(:release_id, :integer, primary_key: true)
    field(:article_id, Ecto.UUID, primary_key: true)
    field(:action, Ecto.Enum, values: [:publish, :delete])
    field(:snapshot_id, Ecto.UUID)
  end

  @doc "Builds an immutable Release member before the parent is sealed."
  def changeset(member, attrs) do
    member
    |> cast(attrs, [:release_id, :article_id, :action, :snapshot_id])
    |> validate_required([:release_id, :article_id, :action])
  end
end
