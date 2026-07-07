defmodule GroupherServer.Statistics.Model.UserContribute do
  @moduledoc """
  Ecto schema for daily user contribution counters.

  Statistics jobs and middleware aggregate user activity into these date-bucketed
  rows for profile contribution charts.
  """
  alias __MODULE__

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.statistics()

  @type t :: %UserContribute{}
  schema "user_contributes" do
    field(:count, :integer)
    field(:date, :date)
    belongs_to(:user, User)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%UserContribute{} = user_contribute, attrs) do
    user_contribute
    |> cast(attrs, [:date, :count, :user_id])
    |> validate_required([:date, :count, :user_id])
    |> foreign_key_constraint(:user_id)
  end
end
