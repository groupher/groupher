defmodule GroupherServer.CMS.Passport.Authorization do
  @moduledoc """
  Actor-facing Passport authorization seam.

  It answers whether a normalized Passport grants an action in a community;
  it does not decide resource Lifecycle or Gate admission.

      Gate policy -> CMS.Passport.Authorization -> allow or deny
  """

  require GroupherServer.CMS.Passport.ErrorCat

  alias GroupherServer.CMS

  alias CMS.Passport.{ErrorCat, Registry}

  @doc """
  Asks whether one normalized passport grants an action in a community.

  The decision is delegated to `Passport.Registry`. Actions outside the
  registered catalog resolve to an `ErrorCat.Error` with reason `:unknown_action`.

  ## Examples

      Authorization.allowed?(passport, "community-slug", "post.edit")
      #=> {:ok, true}

      Authorization.allowed?(passport, "community-slug", "unknown.action")
      #=> {:error, ErrorCat.error_pattern(reason: :unknown_action)}

  """
  def allowed?(passport, community, action) do
    Registry.allowed?(passport, community, action)
  end

  @doc """
  Checks an action for one user inside an optional context map.

  The user's `cur_passport` is matched against the action requirement for the
  community found in `context` (either `:community` or `"community"` key).
  Denied and unknown actions map to domain errors.

  ## Examples

      Authorization.check(user, "post.edit", %{community: %{slug: "elixir"}})
      #=> {:ok, true}

      Authorization.check(user, "post.edit", %{community: %{slug: "elixir"}})
      #=> {:error, ErrorCat.error_pattern(reason: :permission_denied)}

      Authorization.check(user, "unknown.action", %{})
      #=> {:error, ErrorCat.error_pattern(reason: :unknown_passport_action)}

  """
  def check(user, action, context \\ %{}) when is_map(context) do
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
