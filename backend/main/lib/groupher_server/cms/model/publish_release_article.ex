defmodule GroupherServer.CMS.Model.PublishReleaseArticle do
  @moduledoc """
  Article snapshot membership for one docs release.

  The row stores immutable `snapshot_id` rather than the mutable
  `workspace_id`. The physical public version row may be overwritten by a
  later publish, while the snapshot remains the frozen content used by release
  diff and rollback.

      publish_release_articles
      ├─ article_id          # stable public article identity
      ├─ snapshot_id # immutable content snapshot
      ├─ node_id/group/index # tree position in this release view
      └─ actions             # release-level summary, e.g. ["modified", "moved"]

  ## Example

      %PublishReleaseArticle{
        article_id: 12,
        snapshot_id: 98,
        actions: ["modified", "moved"]
      }
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{ArticleSnapshot, PublishRelease}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @actions ~w(created modified deleted renamed moved unchanged)
  @required_fields ~w(release_id article_id snapshot_id title actions)a
  @optional_fields ~w(node_id group_node_id index)a

  @type t :: %PublishReleaseArticle{}
  schema "publish_release_articles" do
    belongs_to(:release, PublishRelease)
    belongs_to(:snapshot, ArticleSnapshot)

    field(:article_id, :integer)
    field(:node_id, :string)
    field(:group_node_id, :string)
    field(:index, :integer)
    field(:title, :string)
    field(:actions, {:array, :string}, default: [])

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%PublishReleaseArticle{} = row, attrs) do
    row
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:article_id, greater_than: 0)
    |> validate_subset(:actions, @actions)
    |> foreign_key_constraint(:release_id)
    |> foreign_key_constraint(:snapshot_id)
  end
end
