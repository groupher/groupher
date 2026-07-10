defmodule GroupherServer.CMS.Model.DocsBranch do
  @moduledoc """
  Branch scope for docs draft/public state.

  The current product path resolves to the `main` branch. Future preview
  branches can share the same tree, draft, and release workflow by changing only
  the resolved branch row instead of duplicating the publish pipeline.
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.{Community, DocTreeSnapshot, PublishRelease}
  alias Helper.Constant.DBPrefix
  alias Helper.Validator.Slug

  require CMS.Const

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(community_id slug title kind status)a
  @optional_fields ~w(base_release_id base_snapshot_id created_by_id)a

  @type t :: %DocsBranch{}

  schema "docs_branches" do
    belongs_to(:community, Community)
    belongs_to(:base_release, PublishRelease)
    belongs_to(:base_snapshot, DocTreeSnapshot)
    belongs_to(:created_by, User)

    field(:slug, :string)
    field(:title, :string)
    field(:kind, Ecto.Enum, values: CMS.Const.docs_branch_kind_values())
    field(:status, Ecto.Enum, values: CMS.Const.docs_branch_status_values())

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%DocsBranch{} = branch, attrs) do
    branch
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_length(:slug, min: 1, max: 80)
    |> validate_length(:title, min: 1, max: 100)
    |> Slug.validate_changeset(:slug)
    |> validate_inclusion(:kind, CMS.Const.docs_branch_kind_enum_values())
    |> validate_inclusion(:status, CMS.Const.docs_branch_status_enum_values())
    |> validate_base_scope()
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:base_release_id)
    |> foreign_key_constraint(:base_snapshot_id)
    |> foreign_key_constraint(:created_by_id)
    |> unique_constraint(:slug, name: :docs_branches_community_slug_index)
  end

  @doc false
  def update_changeset(%DocsBranch{} = branch, attrs), do: changeset(branch, attrs)

  defp validate_base_scope(changeset) do
    prepare_changes(changeset, fn changeset ->
      community_id = get_field(changeset, :community_id)

      changeset
      |> validate_base_reference(:base_release_id, PublishRelease, community_id)
      |> validate_base_reference(:base_snapshot_id, DocTreeSnapshot, community_id)
    end)
  end

  defp validate_base_reference(changeset, field, schema, community_id) do
    case get_field(changeset, field) do
      nil ->
        changeset

      id ->
        case changeset.repo.get_by(schema, id: id, community_id: community_id) do
          nil -> add_error(changeset, field, "does not belong to the community")
          _record -> changeset
        end
    end
  end
end
