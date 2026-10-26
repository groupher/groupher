defmodule GroupherServer.CMS.Articles.Bindings do
  @moduledoc """
  Stable internal Facade. Infrastructure access belongs to the delegated Owner.

      caller -> GroupherServer.CMS.Articles.Bindings -> result
  """

  @doc "Delegates all/1 to the owning implementation."
  defdelegate all(arg1), to: GroupherServer.CMS.Articles.Bindings.Persist

  @doc "Delegates get/2 to the owning implementation."
  defdelegate get(arg1, arg2), to: GroupherServer.CMS.Articles.Bindings.Persist

  @doc "Fetches one binding by stable Article and Community ids with a structured not-found error."
  defdelegate fetch_binding(article_id, community_id),
    to: GroupherServer.CMS.Articles.Bindings.Persist

  @doc "Fetches one pinned Article row by stable Article and Community ids."
  defdelegate fetch_pin(article_id, community_id),
    to: GroupherServer.CMS.Articles.Bindings.Persist

  @doc "Resolves one binding id for the supplied stable Article, optionally checking Community."
  defdelegate get_by_id(article, binding_id, community_id),
    to: GroupherServer.CMS.Articles.Bindings.Persist
end
