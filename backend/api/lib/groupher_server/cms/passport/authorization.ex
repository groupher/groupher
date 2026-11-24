defmodule GroupherServer.CMS.Passport.Authorization do
  @moduledoc """
  Actor-facing Passport authorization seam.

  It routes registered Global and Community actions to current Passport Store
  facts. Unknown or unsupported actions fail closed instead of reading the
  legacy actor projection. It does not decide resource Lifecycle or Gate
  admission.

      Gate policy -> CMS.Passport.Authorization -> allow or deny
  """

  alias GroupherServer.{Accounts, CMS, Repo}
  alias CMS.Passport.{Catalog, ErrorCat, Store}
  alias CMS.Model.Community
  alias Accounts.Model.User

  @doc """
  Checks an action for one user inside an optional context map.

  Registered Global and Community actions use current Passport Store rows.
  Unknown actions and scopes that do not belong to this API fail closed.

  ## Examples

      Authorization.check(user, "post.pin", %{community: %{slug: "elixir"}})
      #=> {:ok, true}

      Authorization.check(user_without_permission, "post.pin", %{community: %{slug: "elixir"}})
      #=> {:error, ErrorCat.error_pattern(reason: :permission_denied)}

      Authorization.check(user, "unknown.action", %{})
      #=> {:error, ErrorCat.error_pattern(reason: :unknown_passport_action)}

  """
  def check(user, action, context \\ %{}) when is_map(context) do
    case Catalog.get(action) do
      {:ok, %{scope: :global}} -> check_global(user, action, context)
      {:ok, %{scope: :community}} -> check_community(user, action, context)
      _ -> {:error, ErrorCat.unknown_passport_action()}
    end
  end

  defp check_global(%User{} = user, action, context) do
    with {:ok, scope} <- Store.load_global_scope(user),
         {:ok, allowed} <- Store.allowed_global?(user, scope, action, context_thread(context)) do
      if allowed, do: {:ok, true}, else: {:error, ErrorCat.permission_denied()}
    else
      {:error, _reason} = error -> error
    end
  end

  defp check_global(_user, _action, _context), do: {:error, ErrorCat.permission_denied()}

  defp check_community(%User{} = user, action, context) do
    with {:ok, community} <- context_community(context),
         {:ok, scope} <- Store.load_community_scope(user, community),
         {:ok, allowed} <- Store.allowed_community?(user, scope, action, context_thread(context)) do
      if allowed, do: {:ok, true}, else: {:error, ErrorCat.permission_denied()}
    else
      {:error, reason} when reason in [:invalid_community, :community_not_found] ->
        {:error, ErrorCat.permission_denied()}

      {:error, _reason} = error ->
        error
    end
  end

  defp check_community(_user, _action, _context), do: {:error, ErrorCat.permission_denied()}

  defp context_community(context) when is_map(context) do
    case Map.get(context, :community, Map.get(context, "community")) do
      %Community{id: id} when is_integer(id) -> load_community(id)
      %{id: id} when is_integer(id) -> load_community(id)
      %Community{slug: slug} when is_binary(slug) -> load_community_by_slug(slug)
      %{slug: slug} when is_binary(slug) -> load_community_by_slug(slug)
      slug when is_binary(slug) -> load_community_by_slug(slug)
      _ -> {:error, :invalid_community}
    end
  end

  defp context_community(_context), do: {:error, :invalid_community}

  defp context_thread(context) when is_map(context) do
    Map.get(context, :thread, Map.get(context, "thread"))
  end

  defp context_thread(_context), do: nil

  defp load_community(id) do
    case Repo.get(Community, id) do
      %Community{} = community -> {:ok, community}
      nil -> {:error, :community_not_found}
    end
  end

  defp load_community_by_slug(slug) do
    case Repo.get_by(Community, slug: slug) do
      %Community{} = community -> {:ok, community}
      nil -> {:error, :community_not_found}
    end
  end

  @doc """
  Checks a global reviewer action through the current Global Passport row and
  maps any denial to the review permission error.

  This legacy helper has no Community context; resource-specific authorization
  belongs to Gate Policy, which combines Passport facts with Lifecycle state.

  ## Examples

      Authorization.authorize(reviewer, "community.application.review")
      #=> {:error, ErrorCat.review_permission_denied()}
  """
  @spec authorize(term(), String.t()) :: {:ok, :pass} | {:error, ErrorCat.error()}
  def authorize(user, action) do
    case check(user, action, %{}) do
      {:ok, true} -> {:ok, :pass}
      _ -> {:error, ErrorCat.review_permission_denied()}
    end
  end
end
