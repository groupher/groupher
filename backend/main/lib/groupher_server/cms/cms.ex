defmodule GroupherServer.CMS do
  @moduledoc """
  this module defined basic method to handle [CMS] content [CRUD] ..
  [CMS]: post, job, ...
  [CRUD]: create, update, delete ...
  """
  alias GroupherServer.CMS.Delegate

  alias Delegate.{
    Search,
    ThirdPart
  }

  # Community functions are now in CMS.Communities module
  # Use CMS.Communities.xxx directly

  # Comment functions moved to CMS.Comments module
  # Use CMS.Comments.xxx directly

  # AbuseReport functions moved to CMS.AbuseReports module
  # Use CMS.AbuseReports.xxx directly

  # search
  defdelegate search_articles(thread, args), to: Search

  def search_communities(title), do: Search.search_communities(title)

  def search_communities(title, %GroupherServer.Accounts.Model.User{} = user),
    do: Search.search_communities(title, user)

  def search_communities(title, category), do: Search.search_communities(title, category)

  def search_communities(title, category, user),
    do: Search.search_communities(title, category, user)

  # defdelegate seed_bot, to: Seeds
  defdelegate upload_tokens(), to: ThirdPart
end
