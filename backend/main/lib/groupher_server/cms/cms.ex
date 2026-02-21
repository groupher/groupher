defmodule GroupherServer.CMS do
  @moduledoc """
  this module defined basic method to handle [CMS] content [CRUD] ..
  [CMS]: post, job, ...
  [CRUD]: create, update, delete ...
  """
  alias GroupherServer.CMS.Delegate

  alias Delegate.{
    AbuseReport,
    Search,
    ThirdPart
  }

  # do not pattern match in delegating func, do it on one delegating inside
  # see https://github.com/elixir-lang/elixir/issues/5306

  # Community CRUD: moderators, thread, tag
  # >> tag

  # CommunityOperation

  # Comment functions moved to CMS.Comments module
  # Use CMS.Comments.xxx directly

  # TODO: move report to abuse report module
  defdelegate report_article(article, reason, attr, user), to: AbuseReport
  defdelegate report_comment(comment, reason, attr, user), to: AbuseReport
  defdelegate report_account(account, reason, attr, user), to: AbuseReport
  defdelegate undo_report_account(account, user), to: AbuseReport
  defdelegate undo_report_article(article, user), to: AbuseReport
  defdelegate paged_reports(filter), to: AbuseReport
  defdelegate undo_report_comment(comment, user), to: AbuseReport

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
