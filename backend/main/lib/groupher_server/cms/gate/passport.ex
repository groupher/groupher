defmodule GroupherServer.CMS.Gate.Passport do
  @moduledoc """
  Passport facade and compatibility adapter for Gate checks.

  Business position:

      CMS operation
        -> CMS.Gate
        -> Passport
        -> allow / deny
        -> domain context
  """

  alias GroupherServer.CMS.Communities.Passport, as: Legacy
  alias GroupherServer.CMS.Gate.Passport.Registry

  defdelegate paged_passports(community, key), to: Legacy
  defdelegate all_passport_rules(), to: Legacy
  defdelegate get_passport(user), to: Legacy
  defdelegate stamp_passport(rules, user), to: Legacy
  defdelegate erase_passport(path, user), to: Legacy
  defdelegate delete_passport(user), to: Legacy

  @spec check(map(), String.t(), map()) :: {:ok, true} | {:error, atom()}
  def check(user, passport_action, context \\ %{}) when is_map(context) do
    passport = Map.get(user, :cur_passport) || Map.get(user, "cur_passport")
    community = context |> Map.get(:community, Map.get(context, "community")) |> community_slug()

    case Registry.allowed?(passport, community, passport_action) do
      {:ok, true} -> {:ok, true}
      {:ok, false} -> {:error, :permission_denied}
      {:error, :unknown_action} -> {:error, :unknown_passport_action}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Compatibility contract used by Apply/Review during the namespace migration."
  @spec authorize(map(), String.t()) :: :ok | {:error, :review_permission_denied}
  def authorize(user, passport_action) do
    case check(user, passport_action, %{}) do
      {:ok, true} -> :ok
      _ -> {:error, :review_permission_denied}
    end
  end

  defp community_slug(%{slug: slug}) when is_binary(slug), do: slug
  defp community_slug(slug) when is_binary(slug), do: slug
  defp community_slug(_), do: nil
end
