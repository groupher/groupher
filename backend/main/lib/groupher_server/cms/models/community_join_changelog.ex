defmodule GroupherServer.CMS.Model.CommunityJoinChangelog do
  @moduledoc false
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  import GroupherServer.CMS.Helper.Macros

  alias GroupherServer.CMS
  alias CMS.Model.{Community, Changelog}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  @type t :: %CommunityJoinChangelog{}
  schema "communities_join_changelogs" do
    belongs_to(:community, Community)
    belongs_to(:changelog, Changelog)
  end
end
