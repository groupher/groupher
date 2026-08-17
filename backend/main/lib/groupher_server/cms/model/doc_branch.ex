defmodule GroupherServer.CMS.Model.DocBranch do
  @moduledoc """
  Docs-only workspace branch.

  A DocBranch is a Docs workspace coordinate. Ordinary Post, Blog, and
  Changelog rows never reference this schema.

  community + branch identity -> DocBranch row -> branch-scoped document ownership
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias GroupherServer.CMS.Model.Community
  alias Helper.Constant.DBPrefix
  alias Helper.Validator.Slug

  require CMS.Const

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]
  @required_fields ~w(community_id slug title type status)a
  @optional_fields ~w(source_branch_id created_by_id)a

  @type t :: %DocBranch{}

  schema "doc_branches" do
    belongs_to(:community, Community)
    belongs_to(:source_branch, DocBranch)
    belongs_to(:created_by, User)

    field(:slug, :string)
    field(:title, :string)
    field(:type, Ecto.Enum, values: CMS.Const.doc_branch_type_values())
    field(:status, Ecto.Enum, values: CMS.Const.doc_branch_status_values())

    timestamps(type: :utc_datetime)
  end

  def changeset(%DocBranch{} = branch, attrs) do
    branch
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_length(:slug, min: 1, max: 80)
    |> validate_length(:title, min: 1, max: 100)
    |> Slug.validate_changeset(:slug)
    |> validate_inclusion(:type, CMS.Const.doc_branch_type_enum_values())
    |> validate_inclusion(:status, CMS.Const.doc_branch_status_enum_values())
    |> validate_source_scope()
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:source_branch_id)
    |> foreign_key_constraint(:created_by_id)
    |> unique_constraint(:slug, name: :doc_branches_community_slug_index)
    |> unique_constraint(:type, name: :doc_branches_main_index)
  end

  def update_changeset(%DocBranch{} = branch, attrs), do: changeset(branch, attrs)

  defp validate_source_scope(changeset) do
    prepare_changes(changeset, fn changeset ->
      case get_field(changeset, :source_branch_id) do
        nil ->
          changeset

        source_branch_id ->
          community_id = get_field(changeset, :community_id)

          case changeset.repo.get_by(DocBranch,
                 id: source_branch_id,
                 community_id: community_id
               ) do
            %DocBranch{} -> changeset
            nil -> add_error(changeset, :source_branch_id, "does not belong to the Doc scope")
          end
      end
    end)
  end
end
