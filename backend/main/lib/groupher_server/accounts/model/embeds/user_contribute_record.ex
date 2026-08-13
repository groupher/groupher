defmodule GroupherServer.Accounts.Model.Embeds.UserContributeRecord do
  @moduledoc """
  One date/count entry inside an account contribution summary.

  Business position:

      Accounts context
        -> UserContributeRecord schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  use Ecto.Schema
  use Accessible
  import Ecto.Changeset

  @optional_fields ~w(count date)a

  embedded_schema do
    field(:count, :integer)
    field(:date, :date)
  end

  def changeset(struct, params) do
    struct |> cast(params, @optional_fields)
  end
end
