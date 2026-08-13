defmodule GroupherServer.CMS.Model.Embeds.SocialInfo do
  @type t :: %__MODULE__{}

  @moduledoc """
  Embedded social-platform identity and link published by a community.

  Business position:

      CMS context
        -> SocialInfo schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  @required_fields ~w(platform)a
  @optional_fields ~w(link)a

  embedded_schema do
    field(:platform, :string)
    field(:link, :string)
  end

  def changeset(struct, attrs) do
    struct
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@required_fields)
  end
end
