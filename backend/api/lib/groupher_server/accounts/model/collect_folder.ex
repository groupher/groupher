defmodule GroupherServer.Accounts.Model.CollectFolder do
  @moduledoc """
  Ecto schema for user-owned collect folders.

  The folder stores denormalized counters. Binding-scoped entries live in
  `CollectFolderEntry`, which owns collection pagination and identity.

  Business position:

      Accounts context
        -> CollectFolder schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema
  use Flop.Schema

  @flop_options [filterable: [], sortable: [:id, :inserted_at], pagination_types: [:page, :first]]
  use Accessible

  import Ecto.Changeset

  alias __MODULE__
  alias GroupherServer.Accounts
  alias Accounts.Model.{CollectFolderEntry, Embeds, User}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.account()

  @required_fields ~w(user_id title)a
  @optional_fields ~w(index total_count private desc last_updated)a

  @type t :: %CollectFolder{}
  schema "collect_folders" do
    belongs_to(:user, User, foreign_key: :user_id)
    has_many(:entries, CollectFolderEntry, foreign_key: :folder_id)

    field(:title, :string)
    field(:desc, :string)
    field(:index, :integer)
    field(:total_count, :integer, default: 0)
    field(:private, :boolean, default: false)
    # Tracks the most recent change to the folder's collected items.
    field(:last_updated, :utc_datetime)

    # This embedded document contains only denormalized folder counters.
    embeds_one(:meta, Embeds.CollectFolderMeta, on_replace: :delete)

    timestamps(type: :utc_datetime)
  end

  @doc """
  Requires an owner, a title, and embedded per-thread metadata for the folder.
  An unknown owner is reported as a `:user_id` constraint error.
  """
  def changeset(%CollectFolder{} = collect_folder, attrs) do
    collect_folder
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@required_fields)
    |> cast_embed(:meta, required: true, with: &Embeds.CollectFolderMeta.changeset/2)
    |> validate_length(:title, min: 1)
    |> foreign_key_constraint(:user_id)
  end

  @doc """
  Casts folder attributes and optional counter metadata without requiring a new title or owner.
  A changed title must have at least one character, and the owner foreign key still applies.
  """
  def update_changeset(%CollectFolder{} = collect_folder, attrs) do
    collect_folder
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> cast_embed(:meta, with: &Embeds.CollectFolderMeta.changeset/2)
    |> validate_length(:title, min: 1)
    |> foreign_key_constraint(:user_id)
  end
end
