defmodule GroupherServer.CMS.Model.Embeds.BlogAuthor do
  @type t :: %__MODULE__{}

  @moduledoc """
  Embedded external author profile attached to a blog entry.

  Business position:

      CMS context
        -> BlogAuthor schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  @required_fields ~w(name)a
  @optional_fields ~w(link intro github twitter)a

  embedded_schema do
    field(:name, :string)
    field(:link, :string)
    field(:intro, :string)
    field(:github, :string)
    field(:twitter, :string)
  end

  def changeset(struct, attrs) do
    struct
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@required_fields)
  end
end
