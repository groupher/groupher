defmodule GroupherServer.CMS.Model.CommunityJoinTag do
  @moduledoc false
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import GroupherServer.CMS.Helper.Macros

  alias GroupherServer.CMS.Model.CommunityTag
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  @type t :: %CommunityJoinTag{}
  schema "community_join_tags" do
    belongs_to(:community_tag, CommunityTag)

    article_belongs_to_fields()
  end
end
