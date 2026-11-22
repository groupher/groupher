defmodule GroupherServer.CMS.Passport.Authorization do
  @moduledoc """
  Actor-facing Passport authorization seam.

  It routes registered Global and Community actions to current Passport Store
  facts and keeps unconverted scopes on the legacy Registry path. It does not
  decide resource Lifecycle or Gate admission.

      Gate policy -> CMS.Passport.Authorization -> allow or deny
  """

  require GroupherServer.CMS.Passport.ErrorCat

  alias GroupherServer.{Accounts, CMS, Repo}
  alias CMS.Passport.{Catalog, ErrorCat, Registry, Store}
  alias CMS.Model.Community
  alias Accounts.Model.User

  @doc """
  Asks whether one normalized passport grants an action in a community.

  The decision is delegated to `Passport.Registry`. Actions outside the
  registered catalog resolve to an `ErrorCat.Error` with reason `:unknown_action`.

  ## Examples

      Authorization.allowed?(passport, "community-slug", "post.pin")
      #=> {:ok, true}

      Authorization.allowed?(passport, "community-slug", "unknown.action")
      #=> {:error, ErrorCat.error_pattern(reason: :unknown_action)}

  """
  def allowed?(passport, community, action) do
    Registry.allowed?(passport, community, action)
  end

  @doc """
  Asks whether one normalized passport grants an action scoped to a thread.

  This remains a Passport fact lookup. Gate must still combine the result with
  resource Lifecycle and ancestor admission.

  ## Examples

      Authorization.allowed?(passport, community_slug, "post.pin", :post)
  """
  def allowed?(passport, community, action, thread) do
    Registry.allowed?(passport, community, action, thread)
  end

  @doc """
  Checks an action for one user inside an optional context map.

  Registered Global and Community actions use current Passport Store rows.
  Other actions retain the legacy `cur_passport` lookup for their remaining
  migration batches. Denied and unknown actions map to domain errors.

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
      {:ok, %{scope: :global, grantable: true}} -> check_global(user, action, context)
      {:ok, %{scope: :community, grantable: true}} -> check_community(user, action, context)
      _ -> check_legacy(user, action, context)
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

  defp check_legacy(user, action, context) do
    passport = Map.get(user, :cur_passport) || Map.get(user, "cur_passport")
    community = context |> Map.get(:community, Map.get(context, "community")) |> community_slug()

    case allowed?(passport, community, action) do
      {:ok, true} ->
        {:ok, true}

      {:ok, false} ->
        {:error, ErrorCat.permission_denied()}

      {:error, ErrorCat.error_pattern(reason: :unknown_action)} ->
        {:error, ErrorCat.unknown_passport_action()}

      {:error, reason} ->
        {:error, reason}
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

  defp community_slug(%{slug: slug}) when is_binary(slug), do: slug
  defp community_slug(slug) when is_binary(slug), do: slug
  defp community_slug(_), do: nil
end
