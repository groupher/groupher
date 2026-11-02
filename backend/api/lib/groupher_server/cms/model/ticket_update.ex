defmodule GroupherServer.CMS.Model.TicketUpdate do
  @moduledoc """
  Stores append-only progress updates with explicit public or internal visibility.

      Ticket update command
        -> immutable visibility-scoped update
        -> public detail or internal workbench
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.Article
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()
  @visibilities [:public, :internal]

  schema "ticket_updates" do
    belongs_to(:ticket, Article, type: Ecto.UUID)
    field(:body, :string)
    field(:visibility, Ecto.Enum, values: @visibilities)
    belongs_to(:author, User, type: :id)
    field(:published_at, :utc_datetime)
    belongs_to(:supersedes, __MODULE__, type: Ecto.UUID)
    timestamps(type: :utc_datetime, updated_at: false)
  end

  def changeset(update, attrs) do
    update
    |> cast(attrs, [
      :ticket_id,
      :body,
      :visibility,
      :author_id,
      :published_at,
      :supersedes_id
    ])
    |> validate_required([:ticket_id, :body, :visibility, :author_id])
    |> check_constraint(:published_at, name: :ticket_updates_visibility_published_at_check)
    |> foreign_key_constraint(:ticket_id)
    |> foreign_key_constraint(:author_id)
    |> foreign_key_constraint(:supersedes_id)
    |> unique_constraint(:supersedes_id, name: :ticket_updates_supersedes_unique)
  end

  def visibilities, do: @visibilities
end
