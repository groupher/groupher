defmodule GroupherServer.CMS.Model.DocsSiteState do
  @moduledoc """
  Community-level state for the docs workspace and published snapshot.

      tree_lock_version
          bumps on tree mutations and backs the editor `baseRevision` lock

      site_draft_version
          bumps on any dashboard docs draft mutation

      published_version
          records which site draft version was last published

      base_snapshot_id
          published tree snapshot the staged events sit on

      staged_event_count
          footer badge / tree dirty-state fast path

  Site-level `has_unpublished_changes` is intentionally not stored. It is derived
  as:

      site_draft_version != published_version
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.{Community, DocTreeSnapshot}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(community_id)a
  @optional_fields ~w(tree_lock_version site_draft_version published_version base_snapshot_id staged_event_count last_published_at last_published_by_id)a

  @type t :: %DocsSiteState{}
  schema "docs_site_states" do
    belongs_to(:community, Community)
    belongs_to(:base_snapshot, DocTreeSnapshot)
    belongs_to(:last_published_by, User)

    field(:tree_lock_version, :integer, default: 0)
    field(:site_draft_version, :integer, default: 0)
    field(:published_version, :integer, default: 0)
    field(:staged_event_count, :integer, default: 0)
    field(:last_published_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  def changeset(%DocsSiteState{} = state, attrs) do
    state
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:base_snapshot_id)
    |> foreign_key_constraint(:last_published_by_id)
    |> unique_constraint(:community_id)
  end

  def update_changeset(%DocsSiteState{} = state, attrs) do
    state
    |> cast(attrs, @optional_fields)
    |> foreign_key_constraint(:base_snapshot_id)
    |> foreign_key_constraint(:last_published_by_id)
  end
end
