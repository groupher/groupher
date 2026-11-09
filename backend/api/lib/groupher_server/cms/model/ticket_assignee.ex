defmodule GroupherServer.CMS.Model.TicketAssignee do
  @moduledoc """
  Records which Community moderators are responsible for a Ticket.

      assignee command
        -> Ticket and moderator identity join
        -> internal workbench assignment list
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.Article
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()

  schema "ticket_assignees" do
    belongs_to(:ticket, Article, type: Ecto.UUID)
    belongs_to(:user, User, type: :id)
    timestamps(type: :utc_datetime)
  end

  def changeset(assignee, attrs) do
    assignee
    |> cast(attrs, [:ticket_id, :user_id])
    |> validate_required([:ticket_id, :user_id])
    |> foreign_key_constraint(:ticket_id)
    |> foreign_key_constraint(:user_id)
    |> unique_constraint([:ticket_id, :user_id], name: :ticket_assignees_ticket_user_index)
  end
end
