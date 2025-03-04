defmodule GroupherServer.CMS.Model.CommunityJoinDoc do
  @moduledoc false
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
