defmodule GroupherServer.CMS.Model.ArticleEvent do
  @moduledoc """
  Immutable attribution and version references for a committed Article operation.

      Article operation -> event with same-Article Snapshot references -> history
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @schema_prefix DBPrefix.cms()
  @fields ~w(article_id sequence actor_type actor_id source service_ref actor_snapshot occurred_at
             operation_ref operation_index type working_copy_id before_revision after_revision
             before_snapshot_id after_snapshot_id source_snapshot_id previous_event_id
             source_community_id)a
  @required ~w(article_id sequence actor_type source actor_snapshot occurred_at operation_ref
               operation_index type after_snapshot_id)a

  schema "article_events" do
    field(:article_id, Ecto.UUID)
    field(:sequence, :integer)
    field(:actor_type, Ecto.Enum, values: [:user, :system])
    field(:actor_id, :integer)
    field(:source, Ecto.Enum, values: [:browser, :import, :system])
    field(:service_ref, :string)
    field(:actor_snapshot, :map)
    field(:occurred_at, :utc_datetime)
    field(:operation_ref, Ecto.UUID)
    field(:operation_index, :integer, default: 0)
    field(:type, Ecto.Enum, values: [:create, :edit, :restore, :fork, :publish])
    field(:working_copy_id, Ecto.UUID)
    field(:before_revision, :integer)
    field(:after_revision, :integer)
    field(:before_snapshot_id, Ecto.UUID)
    field(:after_snapshot_id, Ecto.UUID)
    field(:source_snapshot_id, Ecto.UUID)
    field(:previous_event_id, Ecto.UUID)
    field(:source_community_id, :integer)
    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(event, attrs) do
    event
    |> cast(attrs, @fields)
    |> validate_required(@required)
    |> check_constraint(:sequence, name: :article_events_sequence_check)
    |> check_constraint(:actor_type, name: :article_events_actor_check)
    |> check_constraint(:type, name: :article_events_shape_check)
    |> check_constraint(:before_revision, name: :article_events_revision_check)
    |> unique_constraint([:article_id, :sequence])
    |> unique_constraint([:operation_ref, :operation_index])
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:actor_id)
    |> foreign_key_constraint(:source_community_id)
    |> foreign_key_constraint(:before_snapshot_id,
      name: :article_events_before_snapshot_id_owner_fkey
    )
    |> foreign_key_constraint(:after_snapshot_id,
      name: :article_events_after_snapshot_id_owner_fkey
    )
    |> foreign_key_constraint(:source_snapshot_id,
      name: :article_events_source_snapshot_id_owner_fkey
    )
    |> foreign_key_constraint(:previous_event_id, name: :article_events_previous_owner_fkey)
  end
end
