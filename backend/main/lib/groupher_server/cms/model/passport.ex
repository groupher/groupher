defmodule GroupherServer.CMS.Model.Passport do
  @moduledoc false
  alias __MODULE__

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias Helper.Constant.DBPrefix

  @required_fields ~w(rules user_id)a
  @optional_fields ~w(rules)a

  @schema_prefix DBPrefix.cms()

  @type t :: %Passport{}
  schema "passports" do
    field(:rules, :map)
    belongs_to(:user, User)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%Passport{} = passport, attrs) do
    passport
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@optional_fields ++ @required_fields)
    |> unique_constraint(:user_id)
    |> foreign_key_constraint(:user_id)
  end

  @doc false
  def update_changeset(%Passport{} = passport, attrs) do
    passport
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> unique_constraint(:user_id)
    |> foreign_key_constraint(:user_id)
  end
end
