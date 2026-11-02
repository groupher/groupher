defmodule GroupherServer.CMS.Model.TicketTag do
  @moduledoc """
  Associates a Ticket with a tag owned by its Community's Post taxonomy.

      Ticket tag command
        -> Community tag/Ticket join
        -> internal Ticket tag filtering
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Model.CommunityTag
  alias GroupherServer.CMS.Model.Article
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()

  schema "ticket_tags" do
    belongs_to(:ticket, Article, type: Ecto.UUID)
    belongs_to(:community_tag, CommunityTag, type: :id)
    timestamps(type: :utc_datetime)
  end

  def changeset(tag, attrs) do
    tag
    |> cast(attrs, [:ticket_id, :community_tag_id])
    |> validate_required([:ticket_id, :community_tag_id])
    |> foreign_key_constraint(:ticket_id)
    |> foreign_key_constraint(:community_tag_id)
    |> unique_constraint([:ticket_id, :community_tag_id], name: :ticket_tags_ticket_tag_index)
  end
end
