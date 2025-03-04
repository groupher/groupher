defmodule GroupherServer.CMS.Model.CommunityJoinBlog do
  @moduledoc false
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  alias GroupherServer.CMS
  alias CMS.Model.{Community, Blog}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  @type t :: %CommunityJoinBlog{}
  schema "communities_join_blogs" do
    belongs_to(:community, Community)
    belongs_to(:blog, Blog)
  end
end
