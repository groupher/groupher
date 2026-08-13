defmodule GroupherServer.CMS.Model.CommunityJoinDoc do
  @moduledoc """
  Join schema linking communities to published docs.

  Docs have their own identity and publish workflow; this relation anchors the
  published doc into a community surface.

  Business position:

      CMS context
        -> CommunityJoinDoc schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  alias GroupherServer.CMS

  alias CMS.Model.{Community, Doc}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  @type t :: %CommunityJoinDoc{}
  schema "communities_join_docs" do
    belongs_to(:community, Community)
    belongs_to(:doc, Doc)
  end
end
