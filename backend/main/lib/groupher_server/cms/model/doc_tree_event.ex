defmodule GroupherServer.CMS.Model.DocTreeEvent do
  @moduledoc """
  Domain event for docs tree draft changes.

  Events are the human-reviewable staged diff for Tree. A publish attaches the
  staged events to a `DocTreeRevision`; reverting a single action later can use
  `inverse_payload` instead of attempting to diff raw JSON.
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.{Community, DocTreeRevision}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @statuses ~w(staged published reverted discarded)a
  @event_types ~w(
    group.rename
    node.rename
    node.move
    node.marker.update
    link.href.update
    node.update
    node.create
    node.delete
    pin.add
    pin.remove
    pin.reorder
    pin.update
  )

  @required_fields ~w(community_id seq event_type payload inverse_payload status)a
  @optional_fields ~w(author_id published_revision_id reverted_by_event_id)a

  @type t :: %DocTreeEvent{}
  schema "doc_tree_events" do
    belongs_to(:community, Community)
    belongs_to(:author, User)
    belongs_to(:published_revision, DocTreeRevision)
    belongs_to(:reverted_by_event, DocTreeEvent)

    field(:seq, :integer)
    field(:event_type, :string)
    field(:payload, :map)
    field(:inverse_payload, :map)
    field(:status, Ecto.Enum, values: @statuses, default: :staged)

    timestamps(type: :utc_datetime)
  end

  @doc "Returns allowed lifecycle statuses for Tree events."
  def statuses, do: @statuses

  @doc "Returns domain event types supported by Tree staged diffs."
  def event_types, do: @event_types

  @doc false
  def changeset(%DocTreeEvent{} = event, attrs) do
    event
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:seq, greater_than: 0)
    |> validate_inclusion(:event_type, @event_types)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:author_id)
    |> foreign_key_constraint(:published_revision_id)
    |> foreign_key_constraint(:reverted_by_event_id)
    |> unique_constraint(:seq, name: :doc_tree_events_community_seq_index)
  end

  @doc false
  def update_changeset(%DocTreeEvent{} = event, attrs) do
    event
    |> cast(attrs, @optional_fields ++ [:status])
    |> validate_inclusion(:status, @statuses)
  end
end
