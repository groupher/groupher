defmodule GroupherServer.CMS.Tickets.Model.Source do
  @moduledoc """
  Stores a typed source relation while keeping Ticket and source identities independent.

      User Ticket + source type/identity
        -> visibility-guarded relation
        -> source-specific projection and effects
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Model.Article
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()
  @types [:post]

  schema "ticket_sources" do
    belongs_to(:ticket, Article, type: Ecto.UUID)
    belongs_to(:post, Article, type: Ecto.UUID)
    field(:type, Ecto.Enum, values: @types)
    timestamps(type: :utc_datetime)
  end

  def changeset(link, attrs) do
    link
    |> cast(attrs, [:ticket_id, :type, :post_id])
    |> validate_required([:ticket_id, :type, :post_id])
    |> validate_inclusion(:type, @types)
    |> foreign_key_constraint(:ticket_id)
    |> foreign_key_constraint(:post_id)
    |> check_constraint(:type, name: :ticket_sources_type_check)
    |> check_constraint(:ticket_id, name: :ticket_source_requires_user_ticket)
    |> check_constraint(:post_id, name: :ticket_source_scope_guard)
    |> unique_constraint([:ticket_id, :post_id], name: :ticket_sources_ticket_post_index)
  end

  def types, do: @types
end
