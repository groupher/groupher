defmodule GroupherServer.CMS.Model.TicketWorker do
  @moduledoc """
  Records the single User Ticket that owns a private Worker Ticket.

      Worker creation
        -> parent/Worker relation
        -> User Ticket work breakdown
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Model.Article
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()

  schema "ticket_workers" do
    belongs_to(:parent_ticket, Article, type: Ecto.UUID)
    belongs_to(:worker_ticket, Article, type: Ecto.UUID)
    timestamps(type: :utc_datetime)
  end

  def changeset(link, attrs) do
    link
    |> cast(attrs, [:parent_ticket_id, :worker_ticket_id])
    |> validate_required([:parent_ticket_id, :worker_ticket_id])
    |> foreign_key_constraint(:parent_ticket_id)
    |> foreign_key_constraint(:worker_ticket_id)
    |> unique_constraint(:worker_ticket_id, name: :ticket_workers_worker_ticket_index)
  end
end
