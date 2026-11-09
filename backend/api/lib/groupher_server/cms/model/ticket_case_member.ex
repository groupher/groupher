defmodule GroupherServer.CMS.Model.TicketCaseMember do
  @moduledoc """
  Records User Tickets included in a Case without changing either Ticket identity.

      Case membership command
        -> Case/User Ticket relation
        -> Case member and progress projection
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Model.Article
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()

  schema "ticket_case_members" do
    belongs_to(:case_ticket, Article, type: Ecto.UUID)
    belongs_to(:user_ticket, Article, type: Ecto.UUID)
    timestamps(type: :utc_datetime)
  end

  def changeset(link, attrs) do
    link
    |> cast(attrs, [:case_ticket_id, :user_ticket_id])
    |> validate_required([:case_ticket_id, :user_ticket_id])
    |> foreign_key_constraint(:case_ticket_id)
    |> foreign_key_constraint(:user_ticket_id)
    |> unique_constraint([:case_ticket_id, :user_ticket_id],
      name: :ticket_case_members_case_user_index
    )
  end
end
