defmodule GroupherServer.CMS.Model.DocsPostPublishConflict do
  @moduledoc """
  A published Doc whose default copy needs an explicit merge resolution.

      Release conflict -> protected base and published Snapshots -> blocked enqueue
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @primary_key false
  @schema_prefix DBPrefix.cms()

  schema "docs_post_publish_conflicts" do
    field(:community_id, :integer, primary_key: true)
    field(:article_id, Ecto.UUID, primary_key: true)
    field(:base_snapshot_id, Ecto.UUID)
    field(:published_snapshot_id, Ecto.UUID)
    field(:default_revision, :integer)
    timestamps(type: :utc_datetime)
  end

  @doc "Records the locked baseline and published content requiring resolution."
  def changeset(conflict, attrs) do
    conflict
    |> cast(attrs, [
      :community_id,
      :article_id,
      :base_snapshot_id,
      :published_snapshot_id,
      :default_revision
    ])
    |> validate_required([
      :community_id,
      :article_id,
      :base_snapshot_id,
      :published_snapshot_id,
      :default_revision
    ])
    |> validate_number(:default_revision, greater_than: 0)
    |> unique_constraint([:community_id, :article_id], name: :docs_post_publish_conflicts_pkey)
    |> foreign_key_constraint(:base_snapshot_id,
      name: :docs_post_publish_conflicts_base_owner_fkey
    )
    |> foreign_key_constraint(:published_snapshot_id,
      name: :docs_post_publish_conflicts_public_owner_fkey
    )
  end
end
