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

  alias GroupherServer.Accounts

  @doc "Loads a Community by id or public slug."
  def community(id) when is_integer(id), do: GroupherServer.CMS.front_desk_community(id)
  def community(slug) when is_binary(slug), do: GroupherServer.CMS.front_desk_community(slug)

  @doc "Loads a Community with an explicit mode and optional named view."
  def community(ref, opts) when is_list(opts) do
    GroupherServer.CMS.front_desk_community(ref, opts)
  end

  @doc """
  Reads a Community using the actor-aware public or management Gate contract.

  ## Examples

      FrontDesk.community(community_slug, actor, mode: :management)
  """
  @spec community(term(), term(), keyword()) :: {:ok, struct()} | {:error, term()}
  def community(ref, actor, opts), do: GroupherServer.CMS.front_desk_community(ref, actor, opts)

  @doc "Loads a User through the shared User cache by id or public login."
  def user(login) when is_binary(login), do: Accounts.front_desk_user(login)
  def user(id) when is_integer(id), do: Accounts.front_desk_user(id)

  @doc """
  Loads a User with validated mode/view options through Accounts Query.

  ## Examples

      FrontDesk.user("alice", mode: :internal, view: :default)
  """
  def user(ref, opts) when is_list(opts), do: Accounts.front_desk_user(ref, opts)

  @doc "Loads the current User record directly from Accounts, bypassing cached state."
  def fresh_user(id) when is_integer(id), do: Accounts.front_desk_fresh_user(id)
  def fresh_user(login) when is_binary(login), do: Accounts.front_desk_fresh_user(login)

  @doc "Reloads one User from Accounts and refreshes its shared cache entry."
  @spec revalidate_user(String.t() | integer()) :: {:ok, struct()} | {:error, term()}
  defdelegate revalidate_user(ref), to: Accounts, as: :front_desk_revalidate_user

  @doc "Reloads several Users from Accounts and refreshes their shared cache entries."
  @spec revalidate_users([String.t() | integer()]) :: {:ok, [struct()]} | {:error, term()}
  defdelegate revalidate_users(refs), to: Accounts, as: :front_desk_revalidate_users

  @doc "Loads a comment from its public comment path."
  def comment(comment_path) when is_map(comment_path) do
    GroupherServer.CMS.front_desk_comment(comment_path)
  end

  def comment(comment_ref), do: GroupherServer.CMS.front_desk_comment(comment_ref)

  @doc "Loads a comment with an explicit mode/view or Article path and inner id."
  def comment(comment_ref, opts) when is_list(opts) do
    GroupherServer.CMS.front_desk_comment(comment_ref, opts)
  end

  def comment(comment_path, actor) when is_map(comment_path) and is_map(actor) do
    GroupherServer.CMS.front_desk_comment(comment_path, actor)
  end

  @doc """
  Reads a Comment beneath its Article path with an explicit actor and read options.

  ## Examples

      FrontDesk.comment(comment_path, actor, mode: :public, view: :default)
  """
  @spec comment(map(), term(), keyword()) :: {:ok, struct()} | {:error, term()}
  def comment(comment_path, actor, opts) when is_map(comment_path) and is_map(actor) do
    GroupherServer.CMS.front_desk_comment(comment_path, actor, opts)
  end

  @doc "Loads an Article from a public ArticlePath or internal id."
  def article(article_path) when is_map(article_path) do
    GroupherServer.CMS.front_desk_article(article_path)
  end

  def article(article_id) when is_binary(article_id) do
    GroupherServer.CMS.front_desk_article(article_id)
  end

  @doc """
  Reads an Article path or stable ID with explicit mode/view options.

  A public path is Gate-scoped; a stable ID requires `mode: :internal`.

  ## Examples

      FrontDesk.article(article_id, mode: :internal, view: :command_context)
  """
  @spec article(term(), keyword()) :: {:ok, struct()} | {:error, term()}
  def article(article_ref, opts) when is_list(opts) do
    GroupherServer.CMS.front_desk_article(article_ref, opts)
  end

  def article(article_path, actor) when is_map(article_path) do
    GroupherServer.CMS.front_desk_article(article_path, actor)
  end

  @doc """
  Reads an Article path using the actor-aware public or management Gate contract.

  ## Examples

      FrontDesk.article(article_path, actor, mode: :management)
  """
  @spec article(map(), term(), keyword()) :: {:ok, struct()} | {:error, term()}
  def article(article_path, actor, opts) do
    GroupherServer.CMS.front_desk_article(article_path, actor, opts)
  end

  @doc "Returns the author of an Article or Comment."
  def article_author(resource), do: GroupherServer.CMS.front_desk_article_author(resource)

  @doc "Returns the parent Article of a Comment."
  def article_of(comment), do: GroupherServer.CMS.front_desk_article_of(comment)

  @doc "Returns the canonical thread of an Article or Comment."
  def thread_of(resource), do: GroupherServer.CMS.front_desk_thread_of(resource)

  @doc "Reads one Community Tag by id."
  def community_tag(id), do: GroupherServer.CMS.front_desk_community_tag(id)

  @doc "Reads one Community Tag Group by id."
  def community_tag_group(id), do: GroupherServer.CMS.front_desk_community_tag_group(id)
end
