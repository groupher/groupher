defmodule GroupherServer.CMS.Model.Embeds.BlogHistoryFeed do
  @type t :: %__MODULE__{}

  @moduledoc """
  Embedded historical feed item imported for a community blog.

  Business position:

      CMS context
        -> BlogHistoryFeed schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  @optional_fields ~w(title digest link_addr content published_at)a

  embedded_schema do
    field(:title, :string)
    field(:digest, :string)
    field(:link_addr, :string)
    field(:content, :string)
    field(:published, :string)
    field(:updated, :string)
  end

  def changeset(struct, params) do
    struct
    |> cast(params, @optional_fields)
  end
end
