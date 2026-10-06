defmodule GroupherServer.CMS.Model.DocPublishReleaseArticle do
  @moduledoc """
  Immutable branch-version membership for one Docs release.

  The row stores immutable `branch_version_id` alongside the stable `doc_id`.
  The selected public projection may change later, while the branch version
  remains the frozen release coordinate used by history and restore.

      doc_publish_release_articles
      ├─ doc_id      # stable docs identity
      ├─ branch_version_id # immutable branch publication
      ├─ node_id/group/index # tree position in this release view
      └─ actions             # release-level summary, e.g. ["modified", "moved"]

  ## Example

      %DocPublishReleaseArticle{
        doc_id: "7a8f6e3c-1b61-4fc3-bd7b-8f89cf34d522",
        branch_version_id: 98,
        actions: ["modified", "moved"]
      }

  Business position:

      CMS context
        -> DocPublishReleaseArticle schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias __MODULE__
  alias GroupherServer.CMS
  alias CMS.Model.{DocBranchVersion, DocPublishRelease}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(release_id doc_id branch_version_id title actions)a
  @optional_fields ~w(node_id group_node_id index)a

  @type t :: %DocPublishReleaseArticle{}
  schema "doc_publish_release_articles" do
    belongs_to(:release, DocPublishRelease)
    belongs_to(:branch_version, DocBranchVersion)

    field(:doc_id, Ecto.UUID)
    field(:node_id, :string)
    field(:group_node_id, :string)
    field(:index, :integer)
    field(:title, :string)
    field(:actions, {:array, :string}, default: [])

    timestamps(type: :utc_datetime)
  end

  @doc "Builds a DocBranchVersion membership row for a Docs release."
  def changeset(%DocPublishReleaseArticle{} = row, attrs) do
    row
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_subset(:actions, CMS.DocPublishRelease.Const.release_article_action_enum_values())
    |> foreign_key_constraint(:release_id)
    |> foreign_key_constraint(:branch_version_id)
  end
end
