defmodule GroupherServer.CMS.Model.TicketFacet do
  @moduledoc """
  Stores normalized version, operating-system and module values for internal Ticket filtering.

      facet input
        -> normalized Ticket facet rows
        -> internal board and search filters
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Model.Article
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()
  @keys ~w(version os module)

  schema "ticket_facets" do
    belongs_to(:ticket, Article, type: Ecto.UUID)
    field(:key, :string)
    field(:value, :string)
    timestamps(type: :utc_datetime)
  end

  def changeset(facet, attrs) do
    facet
    |> cast(attrs, [:ticket_id, :key, :value])
    |> validate_required([:ticket_id, :key, :value])
    |> validate_inclusion(:key, @keys)
    |> validate_length(:value, min: 1, max: 160)
    |> foreign_key_constraint(:ticket_id)
    |> unique_constraint([:ticket_id, :key, :value], name: :ticket_facets_ticket_key_value_index)
  end
end
