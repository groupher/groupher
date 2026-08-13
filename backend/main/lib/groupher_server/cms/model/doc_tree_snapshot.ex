defmodule GroupherServer.CMS.Model.DocTreeSnapshot do
  @moduledoc """
  Immutable docs tree snapshot captured by a DocPublishRelease.

  A release always records one tree snapshot, even when the release only changed
  article content. This keeps DocPublishRelease and DocTreeSnapshot 1:1 and makes
  rollback read a complete tree state without reconstructing from events.

      DocPublishRelease(release_number=N)
          |
          v
      DocTreeSnapshot(tree_json/tree_hash)

  The snapshot does not have its own number. Use DocPublishRelease.release_number
  when UI needs a human release sequence.

  Business position:

      CMS context
        -> DocTreeSnapshot schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.{Community, ArticleBranch}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(community_id branch_id tree_json tree_hash published_at)a
  @optional_fields ~w(author_id message)a

  @type t :: %DocTreeSnapshot{}
  schema "doc_tree_snapshots" do
    belongs_to(:community, Community)
    belongs_to(:branch, ArticleBranch)
    belongs_to(:author, User)

    field(:tree_json, :map)
    field(:tree_hash, :string)
    field(:message, :string)
    field(:published_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @doc "Builds a Docs Tree Snapshot changeset."
  def changeset(%DocTreeSnapshot{} = snapshot, attrs) do
    snapshot
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:author_id)
  end

  @doc "Builds a metadata-only update changeset for a Docs Tree Snapshot."
  def update_changeset(%DocTreeSnapshot{} = snapshot, attrs) do
    snapshot
    |> cast(attrs, @optional_fields)
  end
end
