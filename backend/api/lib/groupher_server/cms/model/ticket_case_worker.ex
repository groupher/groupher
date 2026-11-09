defmodule GroupherServer.CMS.Model.TicketCaseWorker do
  @moduledoc """
  Marks a member-owned Worker as a shared fix for one Case Ticket.

      Case share command
        -> Case/Worker relation
        -> Case shared-fix projection
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Model.Article
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()

  schema "ticket_case_workers" do
    belongs_to(:case_ticket, Article, type: Ecto.UUID)
    belongs_to(:worker_ticket, Article, type: Ecto.UUID)
    timestamps(type: :utc_datetime)
  end

  def changeset(link, attrs) do
    link
    |> cast(attrs, [:case_ticket_id, :worker_ticket_id])
    |> validate_required([:case_ticket_id, :worker_ticket_id])
    |> foreign_key_constraint(:case_ticket_id)
    |> foreign_key_constraint(:worker_ticket_id)
    |> unique_constraint([:case_ticket_id, :worker_ticket_id],
      name: :ticket_case_workers_case_worker_index
    )
  end
end
