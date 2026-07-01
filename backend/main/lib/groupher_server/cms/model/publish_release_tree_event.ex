defmodule GroupherServer.CMS.Model.PublishReleaseTreeEvent do
  @moduledoc """
  Tree event membership for one docs release.

  `PublishRelease.tree_snapshot_id -> DocTreeSnapshot.tree_json` is the complete
  state snapshot used for rollback and structural diff. This table keeps the
  event explanation used for human-readable publish summaries and future
  event-level revert.

      publish_releases.tree_snapshot_id
           |  full state snapshot
           v
      doc_tree_snapshots.tree_json
           |
           v
      rollback / tree diff

      publish_release_tree_events
           |  selected doc_tree_events copied into the release
           v
      summary / event-level revert

  ## Example

      %PublishReleaseTreeEvent{
        event_type: "node.move",
        label: "Moved API Reference",
        payload: %{"nodeId" => "..."}
      }
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{DocTreeEvent, PublishRelease}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(release_id event_type label payload inverse_payload)a
  @optional_fields ~w(doc_tree_event_id)a

  @type t :: %PublishReleaseTreeEvent{}
  schema "publish_release_tree_events" do
    belongs_to(:release, PublishRelease)
    belongs_to(:doc_tree_event, DocTreeEvent)

    field(:event_type, :string)
    field(:label, :string)
    field(:payload, :map)
    field(:inverse_payload, :map)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%PublishReleaseTreeEvent{} = row, attrs) do
    row
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:release_id)
    |> foreign_key_constraint(:doc_tree_event_id)
  end
end
