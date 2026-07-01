defmodule GroupherServer.CMS.Model.PublishReleaseArticle do
  @moduledoc """
  Article snapshot membership for one docs release.

  The row stores immutable `snapshot_id` rather than the mutable
  `doc_id`. The physical public version row may be overwritten by a
  later publish, while the snapshot remains the frozen content used by release
  diff and rollback.

      publish_release_articles
      ├─ doc_id      # stable docs identity
      ├─ snapshot_id # immutable content snapshot
      ├─ node_id/group/index # tree position in this release view
      └─ actions             # release-level summary, e.g. ["modified", "moved"]

  ## Example

      %PublishReleaseArticle{
        doc_id: "7a8f6e3c-1b61-4fc3-bd7b-8f89cf34d522",
        snapshot_id: 98,
        actions: ["modified", "moved"]
      }
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Model.{ArticleSnapshot, PublishRelease}
  alias Helper.Constant.DBPrefix

  require CMS.Const

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(release_id doc_id snapshot_id title actions)a
  @optional_fields ~w(node_id group_node_id index)a

  @type t :: %PublishReleaseArticle{}
  schema "publish_release_articles" do
    belongs_to(:release, PublishRelease)
    belongs_to(:snapshot, ArticleSnapshot)

    field(:doc_id, Ecto.UUID)
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
    |> validate_subset(:actions, CMS.Const.release_article_action_enum_values())
    |> foreign_key_constraint(:release_id)
    |> foreign_key_constraint(:snapshot_id)
  end
end
