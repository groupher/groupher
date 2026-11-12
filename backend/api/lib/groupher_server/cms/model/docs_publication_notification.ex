defmodule GroupherServer.CMS.Model.DocsPublicationNotification do
  @moduledoc """
  Recipient-specific durable queue approval status notice.

      approval Outbox -> idempotent recipient row -> authorized Docs status surface
  """
  use Ecto.Schema
  @schema_prefix "cms"
  @primary_key false
  schema "docs_publication_notifications" do
    field(:event_id, Ecto.UUID, primary_key: true)
    field(:user_id, :integer, primary_key: true)
    field(:community_id, :integer)
    field(:status, :string)
    field(:queue_revision, :integer)
    field(:inserted_at, :utc_datetime)
  end
end
