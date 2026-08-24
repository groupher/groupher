defmodule GroupherServer.CMS.Model.Embeds.AbuseReportCase do
  @type t :: %__MODULE__{}

  @moduledoc """
  Embedded reason and reporter snapshot for one abuse-report case.

  Business position:

      CMS context
        -> AbuseReportCase schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS.Model.Embeds

  @optional_fields [:reason, :attr]

  embedded_schema do
    field(:reason, :string)
    field(:attr, :string)
    embeds_one(:user, Embeds.User, on_replace: :delete)

    timestamps(type: :utc_datetime)
  end

  def changeset(struct, params) do
    struct
    |> cast(params, @optional_fields)
    |> cast_embed(:user, required: true, with: &Embeds.User.changeset/2)
  end
end
