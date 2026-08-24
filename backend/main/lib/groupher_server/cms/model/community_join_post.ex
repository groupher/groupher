defmodule GroupherServer.CMS.Model.CommunityJoinPost do
  @moduledoc """
  Join schema linking communities to post artiments.

  The join keeps post membership explicit for community feeds, tag stats, and
  moderation queries.

  Business position:

      CMS context
        -> CommunityJoinPost schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  alias GroupherServer.CMS.Model.{Community, Post}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  @type t :: %CommunityJoinPost{}
  schema "communities_join_posts" do
    belongs_to(:community, Community)
    belongs_to(:post, Post)
  end
end
