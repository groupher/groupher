defmodule GroupherServer.CMS.Delegate.Seeds.Articles do
  @moduledoc """
  seeds data for init, should be called ONLY in new database, like migration
  """
  use GroupherServer.TestTools

  # import Helper.Utils, only: [done: 1, get_config: 2]
  import Ecto.Query, warn: false

  alias Helper.ORM
  alias GroupherServer.CMS
  alias GroupherServer.Accounts.Model.User

  alias CMS.Model.{Community}

  # alias CMS.Delegate.Seeds

  @doc """
  seed communities pragraming languages
  """
  # type: city, pl, framework, ...
  def seed_articles(community_slug, thread) do
    with {:ok, community} <- ORM.find_by(Community, slug: community_slug),
         {:ok, user} <- ORM.find(User, 1) do
      attrs = mock_attrs(thread, %{community_id: community.id, original_community: community})
      CMS.create_article(community, thread, attrs, user)
    end
  end
end
