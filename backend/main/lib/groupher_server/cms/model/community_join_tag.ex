defmodule GroupherServer.CMS.Model.CommunityJoinTag do
  @moduledoc """
  Join schema linking artiments to community tags.

  The relation stores tag assignments by thread/source item so tag filtering does
  not need to mutate the source article row.

  Business position:

      CMS context
        -> CommunityJoinTag schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
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
