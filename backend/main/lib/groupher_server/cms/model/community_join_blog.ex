defmodule GroupherServer.CMS.Model.CommunityJoinBlog do
  @moduledoc """
  Join schema linking communities to blog artiments.

  Thread-specific join tables keep community membership/query constraints clear
  while each artiment type keeps its own content table.

  Business position:

      CMS context
        -> CommunityJoinBlog schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  alias GroupherServer.CMS

  alias CMS.Model.{Blog, Community}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  @type t :: %CommunityJoinBlog{}
  schema "communities_join_blogs" do
    belongs_to(:community, Community)
    belongs_to(:blog, Blog)
  end
end
