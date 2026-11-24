# ---
# Absinthe.Middleware behaviour
# see https://hexdocs.pm/absinthe/Absinthe.Middleware.html#content
# ---
defmodule GroupherServerWeb.Middleware.Passport do
  @moduledoc """
  Action-based passport check middleware.

  Permission check flow (wireframe):

      GraphQL field
          -> middleware(M.Passport, action: "...")
          -> CMS.Passport.Catalog scope dispatch
          -> Global / Community Passport Store or fail closed

  Registered Global action example (`community.create`):

      action: "community.create"
          -> load Global Passport scope for actor
          -> check `community.create` against current stored facts

  Registered Community action example (`review.read`):

      action: "review.read"
          -> resolve canonical Community from request arguments
          -> load actor-bound Community Passport scope
          -> check `review.read` against current stored facts

  Notes:

  - `community_slug` comes from request arguments, then selects one community whitelist bucket.
  - `grant_by_thread` requirements are expanded at runtime into concrete grants via `thread` argument.
  - Article mutations parse `arguments.article` into `arguments.article_path` here, but the
    article is still loaded later by the `FrontDesk` article middleware. If an earlier
    `article_editor` middleware already supplied a struct, Passport preserves it.
  - Registered Global / Community actions use current Store facts for root admission.
  - Unknown, Article-scope, and non-grantable actions fail closed.
  """

  @behaviour Absinthe.Middleware

  require GroupherServer.CMS.ErrorCat

  alias GroupherServer.{Accounts, CMS, FrontDesk}
  alias GroupherServerWeb.ErrorResponse

  alias Accounts.Model.User
  alias CMS.ErrorCat, as: CmsErrorCat

  def call(%{errors: errors} = resolution, _) when errors != [] do
    resolution
  end

  def call(resolution, opts) when is_list(opts) do
    case Keyword.fetch(opts, :action) do
      {:ok, action} when is_binary(action) -> authorize_action(resolution, action, opts)
      _ -> missing_action(resolution)
    end
  end

  def call(resolution, _) do
    missing_action(resolution)
  end

  defp authorize_action(resolution, action, opts) do
    case CMS.passport_catalog_action(action) do
      {:ok, %{scope: scope, grantable: true}} when scope in [:global, :community] ->
        case maybe_put_article_path(resolution, opts) do
          {:ok, resolution} ->
            check_catalog_requirement(resolution, action, scope, opts)

          {:error, CmsErrorCat.error_pattern(reason: :invalid_article_path)} ->
            invalid_article_path(resolution)
        end

      _ ->
        unknown_action(resolution, action)
    end
  end

  defp check_catalog_requirement(resolution, action, :global, _opts) do
    with %User{} = actor <- current_user(resolution),
         {:ok, scope} <- CMS.passport_global_scope(actor),
         {:ok, true} <- CMS.passport_allowed?(actor, scope, action) do
      resolution
    else
      _ -> passport_denied(resolution)
    end
  end

  defp check_catalog_requirement(resolution, action, :community, opts) do
    with %User{} = actor <- current_user(resolution),
         {:ok, slug} <- fetch_community_slug(resolution),
         {:ok, community} <- FrontDesk.community(slug, mode: :internal),
         {:ok, scope} <- CMS.passport_community_scope(actor, community),
         {:ok, true} <-
           CMS.passport_allowed?(actor, scope, action, passport_thread(resolution, opts)) do
      maybe_put_passport_scope(resolution, opts, :community, scope)
    else
      _ -> passport_denied(resolution)
    end
  end

  defp maybe_put_passport_scope(resolution, opts, scope_key, scope) do
    if Keyword.get(opts, :pass_scope, false) do
      arguments =
        Map.update(resolution.arguments, :passport_scopes, %{scope_key => scope}, fn scopes ->
          if is_map(scopes), do: Map.put(scopes, scope_key, scope), else: %{scope_key => scope}
        end)

      %{resolution | arguments: arguments}
    else
      resolution
    end
  end

  defp maybe_put_article_path(%{arguments: arguments} = resolution, opts)
       when is_map(arguments) do
    if match?(%{article: %{__struct__: _}}, arguments) do
      {:ok, resolution}
    else
      do_put_article_path(resolution, arguments, opts)
    end
  end

  defp maybe_put_article_path(resolution, _opts), do: {:ok, resolution}

  defp do_put_article_path(resolution, arguments, opts) do
    if Map.has_key?(arguments, :article) or Map.has_key?(arguments, :article_path) do
      # Passport runs before article loading, so it can only prepare the public
      # locator for permission checks. It must not load the article here.
      case CMS.parse_article_arguments(arguments, Keyword.take(opts, [:thread])) do
        {:ok, arguments} ->
          {:ok, %{resolution | arguments: arguments}}

        {:error, CmsErrorCat.error_pattern(reason: :invalid_article_path) = error} ->
          {:error, error}
      end
    else
      {:ok, resolution}
    end
  end

  defp missing_action(resolution) do
    ErrorResponse.put_error(
      resolution,
      CMS.passport_error_cat_passport("PassportError: action is required.")
    )
  end

  defp invalid_article_path(resolution) do
    ErrorResponse.put_error(
      resolution,
      CMS.error_cat_invalid_article_path("invalid article input")
    )
  end

  defp passport_denied(resolution) do
    ErrorResponse.put_error(
      resolution,
      CMS.passport_error_cat_permission_denied("PassportError: your passport not qualified.")
    )
  end

  defp unknown_action(resolution, action) do
    ErrorResponse.put_error(
      resolution,
      CMS.passport_error_cat_unknown_action("PassportError: unknown action #{action}.")
    )
  end

  defp current_user(%{context: %{cur_user: %User{} = user}}), do: user
  defp current_user(_), do: nil

  defp passport_thread(resolution, opts) do
    Keyword.get(opts, :thread) ||
      case fetch_thread(resolution) do
        {:ok, thread} -> thread
        {:error, _reason} -> nil
      end
  end

  defp fetch_thread(%{arguments: %{article_path: %{thread: thread}}}) when is_atom(thread) do
    {:ok, Atom.to_string(thread)}
  end

  defp fetch_thread(%{arguments: %{thread: thread}}) when is_atom(thread) do
    {:ok, Atom.to_string(thread)}
  end

  defp fetch_thread(%{arguments: %{thread: thread}}) when is_binary(thread), do: {:ok, thread}
  defp fetch_thread(_), do: {:error, GroupherServer.CMS.error_cat_missing_thread()}

  defp fetch_community_slug(%{arguments: %{article_path: %{community: %{slug: slug}}}})
       when is_binary(slug) do
    {:ok, slug}
  end

  defp fetch_community_slug(%{arguments: %{article_path: %{community: community}}})
       when is_binary(community) do
    {:ok, community}
  end

  defp fetch_community_slug(%{arguments: %{community: %{slug: slug}}}) when is_binary(slug) do
    {:ok, slug}
  end

  defp fetch_community_slug(%{arguments: %{community: community}}) when is_binary(community) do
    {:ok, community}
  end

  defp fetch_community_slug(%{arguments: %{input: %{community: community}}})
       when is_binary(community) do
    {:ok, community}
  end

  defp fetch_community_slug(_), do: {:error, GroupherServer.CMS.error_cat_missing_community()}
end
