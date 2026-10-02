defmodule GroupherServer.FrontDesk do
  @moduledoc """
  Cross-context lookup facade for public community, user, article, and comment
  references.

  Callers use stable slugs/logins/article paths here instead of knowing whether
  a lookup is cached or delegated to Accounts/CMS. Domain-specific loading and
  authorization remain in the owning context.

  Business position:

      Application caller
        -> FrontDesk
        -> domain / infrastructure boundary
  """

  alias __MODULE__.Cache
  alias GroupherServer.{Accounts, CMS}

  @doc "Loads a Community by id or public slug."
  def community(id) when is_integer(id), do: CMS.FrontDesk.community(id)
  def community(slug) when is_binary(slug), do: CMS.FrontDesk.community(slug)

  @doc "Loads a Community with an explicit actor-aware read mode."
  def community(ref, :operations), do: CMS.FrontDesk.community(ref, :operations)
  def community(ref, actor, opts), do: CMS.FrontDesk.community(ref, actor, opts)

  @doc "Loads a User through the shared User cache by id or public login."
  def user(login) when is_binary(login), do: Cache.user(login)
  def user(id) when is_integer(id), do: Accounts.FrontDesk.user(id)

  @doc "Loads the current User record directly from Accounts, bypassing cached state."
  def fresh_user(id) when is_integer(id), do: Accounts.FrontDesk.fresh_user(id)
  def fresh_user(login) when is_binary(login), do: Accounts.FrontDesk.fresh_user(login)

  @doc "Returns the cache revalidation boundary used after domain writes."
  def revalidate, do: __MODULE__.Revalidate

  @doc "Loads a comment from its public comment path."
  def comment(comment_path) when is_map(comment_path), do: CMS.FrontDesk.comment(comment_path)

  @doc "Loads a comment within a public article path by its inner id."
  def comment(article_path, inner_id), do: CMS.FrontDesk.comment(article_path, inner_id)

  @doc "Loads an Article from its public ArticlePath."
  def article(article_path) when is_map(article_path), do: CMS.FrontDesk.article(article_path)
  def article(article_path, actor) when is_map(article_path), do: CMS.FrontDesk.article(article_path, actor)

  @doc "Returns the author of an Article or Comment."
  def article_author(resource), do: CMS.FrontDesk.article_author(resource)

  @doc "Returns the parent Article of a Comment."
  def article_of(comment), do: CMS.FrontDesk.article_of(comment)

  @doc "Returns the canonical thread of an Article or Comment."
  def thread_of(resource), do: CMS.FrontDesk.thread_of(resource)

  @doc "Reads one Community Tag by id."
  def community_tag(id), do: CMS.FrontDesk.community_tag(id)

  @doc "Reads one Community Tag Group by id."
  def community_tag_group(id), do: CMS.FrontDesk.community_tag_group(id)
end
