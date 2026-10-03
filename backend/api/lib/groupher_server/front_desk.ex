defmodule GroupherServer.FrontDesk do
  @moduledoc """
  Cross-context lookup facade for public, management, and trusted internal
  community, user, article, and comment references.

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
  alias CMS.FrontDesk, as: CMSFrontDesk

  @doc "Loads a Community by id or public slug."
  def community(id) when is_integer(id), do: CMSFrontDesk.community(id)
  def community(slug) when is_binary(slug), do: CMSFrontDesk.community(slug)

  @doc "Loads a Community with an explicit mode and optional named view."
  def community(ref, opts) when is_list(opts), do: CMSFrontDesk.community(ref, opts)
  def community(ref, actor, opts), do: CMSFrontDesk.community(ref, actor, opts)

  @doc "Loads a User through the shared User cache by id or public login."
  def user(login) when is_binary(login), do: Cache.user(login)
  def user(id) when is_integer(id), do: Accounts.FrontDesk.user(id)

  @doc "Loads a User with an explicit internal mode."
  def user(ref, opts) when is_list(opts) do
    case {Keyword.get(opts, :mode, :public), Keyword.get(opts, :view, :default)} do
      {:internal, :default} -> Accounts.FrontDesk.user(ref)
      {:public, :default} -> user(ref)
      _ -> {:error, :unsupported_user_read_mode}
    end
  end

  @doc "Loads the current User record directly from Accounts, bypassing cached state."
  def fresh_user(id) when is_integer(id), do: Accounts.FrontDesk.fresh_user(id)
  def fresh_user(login) when is_binary(login), do: Accounts.FrontDesk.fresh_user(login)

  @doc "Returns the cache revalidation boundary used after domain writes."
  def revalidate, do: __MODULE__.Revalidate

  @doc "Loads a comment from its public comment path."
  def comment(comment_path) when is_map(comment_path), do: CMSFrontDesk.comment(comment_path)

  @doc "Loads a comment with an explicit mode/view or Article path and inner id."
  def comment(comment_ref, opts) when is_list(opts), do: CMSFrontDesk.comment(comment_ref, opts)

  def comment(comment_path, actor) when is_map(comment_path) and is_map(actor),
    do: CMSFrontDesk.comment(comment_path, actor)

  def comment(article_path, inner_id), do: CMSFrontDesk.comment(article_path, inner_id)

  def comment(article_path, inner_id, opts)
      when is_map(article_path) and (is_integer(inner_id) or is_binary(inner_id)) and
             is_list(opts),
      do: CMSFrontDesk.comment(article_path, inner_id, opts)

  def comment(comment_path, actor, opts) when is_map(comment_path) and is_map(actor),
    do: CMSFrontDesk.comment(comment_path, actor, opts)

  @doc "Loads an Article from a public ArticlePath or internal id."
  def article(article_path) when is_map(article_path), do: CMSFrontDesk.article(article_path)
  def article(article_id) when is_binary(article_id), do: CMSFrontDesk.article(article_id)
  def article(article_ref, opts) when is_list(opts), do: CMSFrontDesk.article(article_ref, opts)

  def article(article_path, actor) when is_map(article_path),
    do: CMSFrontDesk.article(article_path, actor)

  def article(article_path, actor, opts), do: CMSFrontDesk.article(article_path, actor, opts)

  @doc "Returns the author of an Article or Comment."
  def article_author(resource), do: CMSFrontDesk.article_author(resource)

  @doc "Returns the parent Article of a Comment."
  def article_of(comment), do: CMSFrontDesk.article_of(comment)

  @doc "Returns the canonical thread of an Article or Comment."
  def thread_of(resource), do: CMSFrontDesk.thread_of(resource)

  @doc "Reads one Community Tag by id."
  def community_tag(id), do: CMSFrontDesk.community_tag(id)

  @doc "Reads one Community Tag Group by id."
  def community_tag_group(id), do: CMSFrontDesk.community_tag_group(id)
end
