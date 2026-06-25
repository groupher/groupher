defmodule GroupherServer.CMS.Model.DocTreeRevision do
  @moduledoc """
  Published docs tree snapshot.

  A tree publish materializes the current draft navigation into a canonical JSON
  snapshot. Tree events explain how the draft got there; this row is the stable
  versioned state public readers and future review flows can compare against.
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

  @required_fields ~w(community_id revision_number tree_json tree_hash published_at)a
  @optional_fields ~w(author_id message)a

  @type t :: %DocTreeRevision{}
  schema "doc_tree_revisions" do
    belongs_to(:community, Community)
    belongs_to(:author, User)

    field(:revision_number, :integer)
    field(:tree_json, :map)
    field(:tree_hash, :string)
    field(:message, :string)
    field(:published_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%DocTreeRevision{} = revision, attrs) do
    revision
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:revision_number, greater_than: 0)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:author_id)
    |> unique_constraint(:revision_number, name: :doc_tree_revisions_community_revision_index)
  end

  @doc false
  def update_changeset(%DocTreeRevision{} = revision, attrs) do
    revision
    |> cast(attrs, @optional_fields)
  end
end
