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
  alias GroupherServer.{Accounts, CMS}
  alias __MODULE__.Cache

  @doc "Loads a community from its public slug."
  def community(slug) when is_binary(slug), do: CMS.FrontDesk.community(slug)

  @doc "Loads a user through the shared user cache by public login."
  def user(login) when is_binary(login), do: Cache.user(login)

  @doc "Loads the current user record directly from Accounts, bypassing cached state."
  def live_user(login, opts \\ []) when is_binary(login),
    do: Accounts.FrontDesk.live_user(login, opts)

  @doc "Returns the cache revalidation boundary used after domain writes."
  def revalidate, do: __MODULE__.Revalidate

  @doc "Loads a comment from its public comment path."
  def comment(comment_path) when is_map(comment_path), do: CMS.FrontDesk.comment(comment_path)

  @doc "Loads a comment within a public article path by its inner id."
  def comment(article_path, inner_id), do: CMS.FrontDesk.comment(article_path, inner_id)

  @doc "Loads an article from its public article path."
  def article(article_path, opts \\ []) when is_map(article_path) and is_list(opts) do
    CMS.FrontDesk.article(article_path, opts)
  end

  @doc "Loads an article from community slug, thread, and public inner id."
  def article(community, thread, inner_id) when is_binary(community) do
    preload = [[author: :user], :community]

    with {:ok, community} <- community(community) do
      CMS.FrontDesk.article(community, thread, inner_id, preload: preload)
    end
  end
end
