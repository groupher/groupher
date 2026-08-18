defmodule GroupherServer.Accounts.Model.Embeds.UserMailbox do
  @moduledoc """
  Embedded unread counters projected onto an account mailbox.

  Business position:

      Accounts context
        -> UserMailbox schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  @optional_fields ~w(is_empty unread_total_count unread_mentions_count unread_notifications_count)a

  def default_status do
    %{
      is_empty: true,
      unread_total_count: 0,
      unread_mentions_count: 0,
      unread_notifications_count: 0
    }
  end

  embedded_schema do
    field(:is_empty, :boolean, default: true)
    field(:unread_total_count, :integer, default: 0)
    field(:unread_mentions_count, :integer, default: 0)
    field(:unread_notifications_count, :integer, default: 0)
  end

  def changeset(struct, params) do
    struct |> cast(params, @optional_fields)
  end
end
