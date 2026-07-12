defmodule GroupherServer.CMS.Model.ArticleBranch do
  @moduledoc """
  Shared branch scope for Article draft state.

      Community + thread
              |
              +--> main branch       # official draft/public lifecycle
              |
              +--> preview branch    # draft-only isolated preview

  Branches own no Article content. Product rows and immutable
  `ArticleSnapshot` records reference the branch through `branch_id`.
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Artiment.Threads
  alias CMS.Model.Community
  alias Helper.Constant.DBPrefix
  alias Helper.Validator.Slug

  require CMS.Const

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(community_id thread slug title type status)a
  @optional_fields ~w(source_branch_id created_by_id)a

  @type t :: %ArticleBranch{}

  schema "article_branches" do
    belongs_to(:community, Community)
    belongs_to(:source_branch, ArticleBranch)
    belongs_to(:created_by, User)

    field(:thread, Ecto.Enum, values: Threads.article_enums())
    field(:slug, :string)
    field(:title, :string)
    field(:type, Ecto.Enum, values: CMS.Const.article_branch_type_values())
    field(:status, Ecto.Enum, values: CMS.Const.article_branch_status_values())

    timestamps(type: :utc_datetime)
  end

  @doc """
  Builds a validated Article branch changeset.

  A source branch, when present, must belong to the same Community and thread.
  """
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%ArticleBranch{} = branch, attrs) do
    branch
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_length(:slug, min: 1, max: 80)
    |> validate_length(:title, min: 1, max: 100)
    |> Slug.validate_changeset(:slug)
    |> validate_inclusion(:thread, Threads.article_enums())
    |> validate_inclusion(:type, CMS.Const.article_branch_type_enum_values())
    |> validate_inclusion(:status, CMS.Const.article_branch_status_enum_values())
    |> validate_source_scope()
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:source_branch_id)
    |> foreign_key_constraint(:created_by_id)
    |> unique_constraint(:slug, name: :article_branches_community_thread_slug_index)
    |> unique_constraint(:type, name: :article_branches_main_index)
  end

  @doc "Updates an Article branch through the same validated contract as creation."
  @spec update_changeset(t(), map()) :: Ecto.Changeset.t()
  def update_changeset(%ArticleBranch{} = branch, attrs), do: changeset(branch, attrs)

  defp validate_source_scope(changeset) do
    prepare_changes(changeset, fn changeset ->
      case get_field(changeset, :source_branch_id) do
        nil ->
          changeset

        source_branch_id ->
          validate_source_branch(
            changeset,
            source_branch_id,
            get_field(changeset, :community_id),
            get_field(changeset, :thread)
          )
      end
    end)
  end

  defp validate_source_branch(changeset, source_branch_id, community_id, thread) do
    case changeset.repo.get_by(ArticleBranch,
           id: source_branch_id,
           community_id: community_id,
           thread: thread
         ) do
      %ArticleBranch{} -> changeset
      nil -> add_error(changeset, :source_branch_id, "does not belong to the Article scope")
    end
  end
end
