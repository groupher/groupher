defmodule GroupherServer.CMS.Model.CommunityJoinPost do
  @moduledoc false
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  import GroupherServer.CMS.Helper.Macros

  alias GroupherServer.CMS
  alias CMS.Model.{Community, Post}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  @type t :: %CommunityJoinPost{}
  schema "communities_join_posts" do
    belongs_to(:community, Community)
    belongs_to(:post, Post)
  end
end
