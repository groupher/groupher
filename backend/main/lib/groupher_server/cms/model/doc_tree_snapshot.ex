defmodule GroupherServer.CMS.Model.DocTreeSnapshot do
  @moduledoc """
  Immutable docs tree snapshot captured by a PublishRelease.

  A release always records one tree snapshot, even when the release only changed
  article content. This keeps PublishRelease and DocTreeSnapshot 1:1 and makes
  rollback read a complete tree state without reconstructing from events.

      PublishRelease(release_number=N)
          |
          v
      DocTreeSnapshot(tree_json/tree_hash)

  The snapshot does not have its own number. Use PublishRelease.release_number
  when UI needs a human release sequence.
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

  @required_fields ~w(community_id tree_json tree_hash published_at)a
  @optional_fields ~w(author_id message)a

  @type t :: %DocTreeSnapshot{}
  schema "doc_tree_snapshots" do
    belongs_to(:community, Community)
    belongs_to(:author, User)

    field(:tree_json, :map)
    field(:tree_hash, :string)
    field(:message, :string)
    field(:published_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%DocTreeSnapshot{} = snapshot, attrs) do
    snapshot
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:author_id)
  end

  @doc false
  def update_changeset(%DocTreeSnapshot{} = snapshot, attrs) do
    snapshot
    |> cast(attrs, @optional_fields)
  end
end
