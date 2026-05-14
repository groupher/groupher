defmodule GroupherServer.CMS.Communities.Passport do
  @moduledoc """
  Passport CRUD.
  """

  import Helper.Utils, only: [done: 1, deep_merge: 2]
  import Ecto.Query, warn: false
  import ShortMaps

  alias GroupherServer.{Accounts, Repo}

  alias Accounts.Model.User
  alias GroupherServer.CMS.Model.Passport, as: UserPassport

  alias Helper.{NestedFilter, ORM, PermissionRegistry, T}

  @spec paged_passports(term(), term()) :: T.domain_res(term())
  def paged_passports(community, key) do
    UserPassport
    |> where(
      [p],
      fragment("(?->?->'cms'->>?)::boolean = ?", p.rules, ^community, ^key, true)
    )
    |> Repo.all()
    |> done
  end

  @spec all_passport_rules() :: T.domain_res(term())
  def all_passport_rules do
    PermissionRegistry.all_passport_rules() |> done
  end

  @doc """
  return a user's passport in CMS context
  """
  @spec get_passport(User.t()) :: T.domain_res(term())
  def get_passport(%User{} = user) do
    with {:ok, _} <- ORM.find(User, user.id) do
      case ORM.find_by(UserPassport, user_id: user.id) do
        {:ok, passport} ->
          {:ok, PermissionRegistry.normalize_rules(passport.rules)}

        {:error, _error} ->
          {:ok, PermissionRegistry.empty_rules()}
      end
    end
  end

  @doc """
  insert or update a user's passport in CMS context
  """
  @spec stamp_passport(term(), User.t()) :: T.domain_res(term())
  def stamp_passport(rules, %User{id: user_id}) do
    with {:ok, rules} <- validate_shape(rules),
         true <- PermissionRegistry.valid_rules?(rules) do
      case ORM.find_by(UserPassport, user_id: user_id) do
        {:ok, passport} ->
          merged_rules =
            passport.rules
            |> PermissionRegistry.normalize_rules()
            |> deep_merge(rules)
            |> reject_invalid_rules()

          passport |> ORM.update(%{rules: merged_rules})

        {:error, _} ->
          rules = rules |> reject_invalid_rules()
          UserPassport |> ORM.create(~m(user_id rules)a)
      end
    else
      {:error, :invalid_passport_shape} ->
        {:error, {:invalid_passport_shape, "passport rules must contain global"}}

      false ->
        {:error, {:invalid_passport_permission, "contains invalid permission key"}}
    end
  end

  @spec erase_passport(term(), User.t()) :: T.domain_res(term())
  def erase_passport(rules_path, %User{id: user_id}) when is_list(rules_path) do
    with {:ok, passport} <- ORM.find_by(UserPassport, user_id: user_id),
         {:ok, rules_path} <- validate_erase_path(rules_path) do
      case pop_in(passport.rules, rules_path) do
        {nil, _} ->
          {:ok, passport}

        {_, lefts} ->
          lefts = lefts |> PermissionRegistry.normalize_rules() |> reject_invalid_rules()
          passport |> ORM.update(%{rules: lefts})
      end
    end
  end

  @spec delete_passport(User.t()) :: T.domain_res(term())
  def delete_passport(%User{id: user_id}) do
    ORM.findby_delete!(UserPassport, ~m(user_id)a)
  end

  defp validate_shape(rules) do
    case rules do
      %{"global" => global} when is_map(global) ->
        {:ok, PermissionRegistry.normalize_rules(rules)}

      %{global: global} when is_map(global) ->
        {:ok, PermissionRegistry.normalize_rules(rules)}

      _ ->
        {:error, :invalid_passport_shape}
    end
  end

  defp validate_erase_path(["global", permission]) when is_binary(permission),
    do: {:ok, ["global", permission]}

  defp validate_erase_path([community, "cms", permission])
       when is_binary(community) and is_binary(permission),
       do: {:ok, [community, "cms", permission]}

  defp validate_erase_path([community, "cms"]) when is_binary(community),
    do: {:ok, [community, "cms"]}

  defp validate_erase_path([community]) when is_binary(community) and community != "global",
    do: {:ok, [community]}

  defp validate_erase_path(_), do: {:error, :invalid_passport_shape}

  defp reject_invalid_rules(rules) when is_map(rules) do
    cleaned =
      rules
      |> NestedFilter.drop_by_value([false])
      |> reject_empty_values()

    Map.put(cleaned, "global", Map.get(cleaned, "global", %{}))
  end

  defp reject_empty_values(map) when is_map(map) do
    map
    |> Enum.reduce(%{}, fn {k, v}, acc ->
      value =
        cond do
          is_map(v) -> reject_empty_values(v)
          true -> v
        end

      if value == %{}, do: acc, else: Map.put(acc, k, value)
    end)
  end
end
