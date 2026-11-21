defmodule GroupherServer.CMS.Model.GlobalPassport do
  @moduledoc """
  Stores a user's Global Passport facts independently of Community membership.

      Passport Store -> GlobalPassport -> global permission facts

  The owning Passport boundary validates catalog membership and delegation;
  this schema does not authorize an actor or manage transactions.
  """
  use Ecto.Schema

  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @schema_prefix DBPrefix.cms()

  @type t :: %__MODULE__{}

  schema "global_passports" do
    field(:user_id, :integer)
    field(:is_root, :boolean, default: false)
    field(:permissions, :map, default: %{})
    field(:revision, :integer, default: 1)
    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(passport, attrs) do
    passport
    |> cast(attrs, [:user_id, :is_root, :permissions, :revision])
    |> validate_required([:user_id, :permissions, :revision])
    |> validate_number(:revision, greater_than: 0)
    |> unique_constraint(:user_id)
    |> foreign_key_constraint(:user_id)
    |> check_constraint(:revision, name: :global_passports_revision_check)
  end
end
