defmodule GroupherServer.CMS.Model.ArticleSnapshot do
  @moduledoc """
  Immutable revision checkpoint for every Article thread.

      current Article row
              |
              | checkpoint / publish / fork / promote / restore
              v
      ArticleSnapshot(revision_number=N)
              |
              +--> Diff reads any two Snapshots
              +--> Restore copies versioned state into a new/current Draft

  Snapshots are append-only full checkpoints, never patches. `revision_number`
  is one branch-local timeline shared by draft and public events.
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Artiment.Threads
  alias CMS.Model.{ArticleBranch, Author, Community}
  alias Helper.Constant.DBPrefix

  require CMS.Const

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @max_subtitle_length 240
  @required_fields ~w(community_id branch_id article_hash_id thread stage action title document_json body_bag version_hash revision_number)a
  @optional_fields ~w(parent_snapshot_id source_snapshot_id author_id slug subtitle digest data schema_version message)a

  @type snapshot_stage :: :draft | :public
  @type t :: %ArticleSnapshot{}

  schema "article_snapshots" do
    belongs_to(:community, Community)
    belongs_to(:branch, ArticleBranch)
    belongs_to(:parent_snapshot, ArticleSnapshot)
    belongs_to(:source_snapshot, ArticleSnapshot)
    belongs_to(:author, Author)

    field(:hash_id, Ecto.UUID, autogenerate: true)
    field(:article_hash_id, Ecto.UUID)
    field(:thread, Ecto.Enum, values: Threads.article_enums())
    field(:stage, Ecto.Enum, values: CMS.Const.stage_values())
    field(:action, Ecto.Enum, values: CMS.Const.article_snapshot_action_values())
    field(:title, :string)
    field(:slug, :string)
    field(:subtitle, :string)
    field(:digest, :string)
    field(:document_json, :string)
    field(:body_bag, :map)
    field(:data, :map, default: %{})
    field(:version_hash, :string)
    field(:revision_number, :integer)
    field(:schema_version, :integer, default: 1)
    field(:message, :string)

    timestamps(type: :utc_datetime)
  end

  @doc "Returns the allowed draft/public origin stages for revision checkpoints."
  @spec stages() :: [atom()]
  def stages, do: CMS.Const.stage_enum_values()

  @doc "Returns the allowed lifecycle actions recorded by a Snapshot."
  @spec actions() :: [atom()]
  def actions, do: CMS.Const.article_snapshot_action_enum_values()

  @doc """
  Builds an immutable Article Snapshot changeset.

  The referenced Branch must match the Community and thread. Preview branches
  may record only draft Snapshots; official public Snapshots belong to main.
  """
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%ArticleSnapshot{} = snapshot, attrs) do
    snapshot
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:thread, Threads.article_enums())
    |> validate_inclusion(:stage, CMS.Const.stage_enum_values())
    |> validate_inclusion(:action, CMS.Const.article_snapshot_action_enum_values())
    |> validate_number(:revision_number, greater_than: 0)
    |> validate_length(:title, min: 1, max: 100)
    |> validate_length(:subtitle, max: @max_subtitle_length)
    |> validate_branch_scope()
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:parent_snapshot_id)
    |> foreign_key_constraint(:source_snapshot_id)
    |> foreign_key_constraint(:author_id)
    |> check_constraint(:article_hash_id, name: :article_snapshots_target_check)
    |> check_constraint(:stage, name: :article_snapshots_stage_check)
    |> check_constraint(:thread, name: :article_snapshots_thread_check)
    |> check_constraint(:action, name: :article_snapshots_action_check)
    |> unique_constraint(:revision_number, name: :article_snapshots_revision_index)
    |> unique_constraint(:hash_id)
  end

  defp validate_branch_scope(changeset) do
    prepare_changes(changeset, fn changeset ->
      branch_id = get_field(changeset, :branch_id)
      community_id = get_field(changeset, :community_id)
      thread = get_field(changeset, :thread)

      case changeset.repo.get_by(ArticleBranch,
             id: branch_id,
             community_id: community_id,
             thread: thread
           ) do
        %ArticleBranch{type: type} -> validate_preview_stage(changeset, type)
        nil -> add_error(changeset, :branch_id, "does not belong to the Article scope")
      end
    end)
  end

  defp validate_preview_stage(changeset, type) do
    if type == CMS.Const.article_branch_type(:preview) and
         get_field(changeset, :stage) == CMS.Const.stage(:public) do
      add_error(changeset, :stage, "preview branches can not contain public Snapshots")
    else
      changeset
    end
  end
end
