defmodule GroupherServer.CMS.Model.DocsSiteState do
  @moduledoc """
  Community-level state for the docs workspace and published snapshot.

      draft_revision
          bumps on any dashboard docs draft mutation

      published_revision
          will bump when the future publish service updates public docs

      last_published_draft_revision
          records which draft revision was last published

  `has_unpublished_changes` is intentionally not stored. It is derived as:

      draft_revision != last_published_draft_revision
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.Community
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(community_id)a
  @optional_fields ~w(draft_revision published_revision last_published_draft_revision last_published_at last_published_by_id)a

  @type t :: %DocsSiteState{}
  schema "docs_site_states" do
    belongs_to(:community, Community)
    belongs_to(:last_published_by, User)

    field(:draft_revision, :integer, default: 0)
    field(:published_revision, :integer, default: 0)
    field(:last_published_draft_revision, :integer, default: 0)
    field(:last_published_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  def changeset(%DocsSiteState{} = state, attrs) do
    state
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:last_published_by_id)
    |> unique_constraint(:community_id)
  end

  def update_changeset(%DocsSiteState{} = state, attrs) do
    state
    |> cast(attrs, @optional_fields)
    |> foreign_key_constraint(:last_published_by_id)
  end
end
