defmodule GroupherServer.CMS.Model.DocSnapshot do
  require GroupherServer.CMS.Docs.Const
  @moduledoc """
  Immutable revision checkpoint for Doc content.

      current Article row
              |
              | checkpoint / publish / restore
              v
      DocSnapshot(revision_number=N)
              |
              +--> Diff reads any two Snapshots
              +--> Restore copies versioned state into a new/current Draft

  Snapshots are append-only full checkpoints, never patches. `revision_number`
  is a branch-local timeline shared by draft and public events.
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias GroupherServer.CMS.Model.{Author, Community, DocBranch}
  alias Helper.Constant.DBPrefix

  require CMS.Const

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @max_subtitle_length 240
  @required_fields ~w(community_id branch_id article_hash_id stage action title document_json body_bag version_hash revision_number)a
  @optional_fields ~w(parent_snapshot_id source_snapshot_id author_id slug subtitle digest data schema_version message)a

  @type snapshot_stage :: :draft | :public
  @type t :: %DocSnapshot{}

  schema "doc_snapshots" do
    belongs_to(:community, Community)
    belongs_to(:branch, DocBranch)
    belongs_to(:parent_snapshot, DocSnapshot)
    belongs_to(:source_snapshot, DocSnapshot)
    belongs_to(:author, Author)

    field(:hash_id, Ecto.UUID, autogenerate: true)
    field(:article_hash_id, Ecto.UUID)
    field(:stage, Ecto.Enum, values: CMS.Const.stage_values())
    field(:action, Ecto.Enum, values: CMS.Docs.Const.doc_snapshot_action_values())
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
  def actions, do: CMS.Docs.Const.doc_snapshot_action_enum_values()

  @doc """
  Builds an immutable Doc Snapshot changeset.

  The referenced DocBranch must match the Community. Non-main branches may
  record only draft snapshots; official public snapshots belong to main.
  """
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%DocSnapshot{} = snapshot, attrs) do
    snapshot
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:stage, CMS.Const.stage_enum_values())
    |> validate_inclusion(:action, CMS.Docs.Const.doc_snapshot_action_enum_values())
    |> validate_number(:revision_number, greater_than: 0)
    |> validate_length(:title, min: 1, max: 100)
    |> validate_length(:subtitle, max: @max_subtitle_length)
    |> validate_branch_scope()
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:parent_snapshot_id)
    |> foreign_key_constraint(:source_snapshot_id)
    |> foreign_key_constraint(:author_id)
    |> check_constraint(:article_hash_id, name: :doc_snapshots_target_check)
    |> check_constraint(:stage, name: :doc_snapshots_stage_check)
    |> check_constraint(:action, name: :doc_snapshots_action_check)
    |> unique_constraint(:revision_number, name: :doc_snapshots_revision_index)
    |> unique_constraint(:hash_id)
  end

  defp validate_branch_scope(changeset) do
    prepare_changes(changeset, fn changeset ->
      branch_id = get_field(changeset, :branch_id)
      community_id = get_field(changeset, :community_id)

      case changeset.repo.get_by(DocBranch,
             id: branch_id,
             community_id: community_id
           ) do
        %DocBranch{} -> changeset
        nil -> add_error(changeset, :branch_id, "does not belong to the Doc scope")
      end
    end)
  end
end
