defmodule GroupherServer.CMS.Model.DocTreeDraftState do
  @moduledoc """
  Narrow revision state for the dashboard tree editor.

  This revision is returned by the `docTree` GraphQL field and checked by tree
  mutations through `baseRevision`. It is separate from `DocsSiteState` so the
  editor can do lightweight conflict detection while site-level publish state
  remains explicit.
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Model.Community
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(community_id)a
  @optional_fields ~w(revision)a

  @type t :: %DocTreeDraftState{}
  schema "doc_tree_draft_states" do
    belongs_to(:community, Community)
    field(:revision, :integer, default: 0)

    timestamps(type: :utc_datetime)
  end

  def changeset(%DocTreeDraftState{} = state, attrs) do
    state
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:community_id)
    |> unique_constraint(:community_id)
  end

  def update_changeset(%DocTreeDraftState{} = state, attrs) do
    state
    |> cast(attrs, @optional_fields)
  end
end
