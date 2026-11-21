defmodule GroupherServer.CMS.Model.DocsRelease do
  @moduledoc """
  Immutable, site-owned record of one published Docs plan.

      published plan -> sealed Release -> immutable tree and Article snapshots
  """

  use Ecto.Schema
  import Ecto.Changeset
  alias Helper.Constant.DBPrefix
  @schema_prefix DBPrefix.cms()

  schema "doc_publish_releases" do
    field(:community_id, :integer)
    field(:tree_snapshot_id, :integer)
    field(:queue_revision, :integer)
    field(:base_release_id, :integer)
    field(:approval_id, Ecto.UUID)
    field(:plan_format_version, :integer)
    field(:sealed, :boolean, default: false)
    field(:published_by_id, :integer)
    field(:published_at, :utc_datetime)
  end

  @doc "Builds a Release inside the transaction that seals its immutable members."
  def changeset(release, attrs) do
    release
    |> cast(attrs, [
      :community_id,
      :tree_snapshot_id,
      :queue_revision,
      :base_release_id,
      :approval_id,
      :plan_format_version,
      :sealed,
      :published_by_id,
      :published_at
    ])
    |> validate_required([
      :community_id,
      :tree_snapshot_id,
      :queue_revision,
      :plan_format_version,
      :published_by_id,
      :published_at
    ])
  end
end
