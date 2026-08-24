defmodule GroupherServer.CMS.Model.CommunityJoinChangelog do
  @moduledoc """
  Join schema linking communities to changelog artiments.

  It lets changelog content stay in its own table while community feeds can query
  membership and ordering through a dedicated relation.

  Business position:

      CMS context
        -> CommunityJoinChangelog schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  alias GroupherServer.CMS.Model.{Changelog, Community}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  @type t :: %CommunityJoinChangelog{}
  schema "communities_join_changelogs" do
    belongs_to(:community, Community)
    belongs_to(:changelog, Changelog)
  end
end
