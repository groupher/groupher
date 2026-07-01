defmodule GroupherServer.CMS.Model.DocTreeEvent do
  @moduledoc """
  Domain event for docs tree draft changes.

  Events are the human-reviewable staged diff for Tree. A publish attaches the
  staged events to a `DocTreeSnapshot`; reverting a single action later can use
  `inverse_payload` instead of attempting to diff raw JSON.

      owner=tree  -> Tree footer diff/publish owns the event.
      owner=doc   -> Article publish owns the event, such as first exposing a
                     newly created docs page in the tree.

  This keeps new docs page creation out of the Tree SavingBar while still
  recording the tree-side effect as a domain event.
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.{Community, DocTreeSnapshot}
  alias Helper.Constant.DBPrefix

  require CMS.Const

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(community_id seq event_type payload inverse_payload status owner)a
  @optional_fields ~w(author_id snapshot_id reverted_by_event_id doc_id)a

  @type t :: %DocTreeEvent{}
  schema "doc_tree_events" do
    belongs_to(:community, Community)
    belongs_to(:author, User)
    belongs_to(:snapshot, DocTreeSnapshot)
    belongs_to(:reverted_by_event, DocTreeEvent)
    field(:doc_id, Ecto.UUID)

    field(:seq, :integer)
    field(:event_type, :string)
    field(:payload, :map)
    field(:inverse_payload, :map)

    field(:status, Ecto.Enum,
      values: CMS.Const.tree_event_status_values(),
      default: CMS.Const.tree_event_status(:staged)
    )

    field(:owner, Ecto.Enum,
      values: CMS.Const.tree_event_owner_values(),
      default: CMS.Const.tree_event_owner(:tree)
    )

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%DocTreeEvent{} = event, attrs) do
    event
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:seq, greater_than: 0)
    |> validate_inclusion(:event_type, CMS.Const.tree_event_enum_values())
    |> validate_doc_owner_binding()
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:author_id)
    |> foreign_key_constraint(:snapshot_id)
    |> foreign_key_constraint(:reverted_by_event_id)
    |> unique_constraint(:seq, name: :doc_tree_events_community_seq_index)
  end

  @doc false
  def update_changeset(%DocTreeEvent{} = event, attrs) do
    event
    |> cast(attrs, @optional_fields ++ [:status, :owner])
    |> validate_inclusion(:status, CMS.Const.tree_event_status_enum_values())
    |> validate_inclusion(:owner, CMS.Const.tree_event_owner_enum_values())
    |> validate_doc_owner_binding()
  end

  defp validate_doc_owner_binding(changeset) do
    case get_field(changeset, :owner) do
      CMS.Const.tree_event_owner(:doc) -> validate_required(changeset, [:doc_id])
      _ -> changeset
    end
  end
end
