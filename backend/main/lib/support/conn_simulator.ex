defmodule GroupherServer.Test.ConnSimulator do
  @moduledoc """
  mock user_conn, owner_conn, guest_conn
  """
  import GroupherServer.Support.Factory
  import Phoenix.ConnTest, only: [build_conn: 0]
  import Plug.Conn, only: [put_req_header: 3]

  import GroupherServer.CMS.FrontDesk, only: [author_of: 1]

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias Helper.{Guardian, ORM, PermissionRegistry}

  @spec simu_conn(:guest | :invalid_token | :user) :: Plug.Conn.t()
  def simu_conn(:guest) do
    build_conn()
  end

  def simu_conn(:user) do
    user_attr = mock_attrs(:user)
    {:ok, user} = db_insert(:user, user_attr)
    token = gen_jwt_token(id: user.id)

    build_conn() |> put_req_header("authorization", token)
  end

  def simu_conn(:invalid_token) do
    token = "invalid_token"

    build_conn() |> put_req_header("authorization", token)
  end

  def simu_conn(:owner, content) do
    with {:ok, author} <- author_of(content) do
      token = gen_jwt_token(id: author.id)

      build_conn() |> put_req_header("authorization", token)
    end
  end

  def simu_conn(:user, %User{} = user) do
    token = gen_jwt_token(id: user.id)

    build_conn() |> put_req_header("authorization", token)
  end

  def simu_conn(:user, cms: passport_rules) do
    user_attr = mock_attrs(:user)
    {:ok, user} = db_insert(:user, user_attr)

    token = gen_jwt_token(id: user.id)

    {:ok, _passport} =
      passport_rules
      |> normalize_passport_rules()
      |> CMS.Communities.stamp_passport(%User{id: user.id})

    build_conn() |> put_req_header("authorization", token)
  end

  def simu_conn(:user, %User{} = user, cms: passport_rules) do
    token = gen_jwt_token(id: user.id)

    {:ok, _passport} =
      passport_rules
      |> normalize_passport_rules()
      |> CMS.Communities.stamp_passport(%User{id: user.id})

    build_conn() |> put_req_header("authorization", token)
  end

  defp gen_jwt_token(clauses) do
    with {:ok, user} <- ORM.find_by(User, clauses) do
      {:ok, token, _info} = Guardian.jwt_encode(user)

      "Bearer #{token}"
    end
  end

  defp normalize_passport_rules(%{"global" => _global, "cms" => _cms} = rules),
    do: sanitize_passport_rules(rules)

  defp normalize_passport_rules(rules) when is_map(rules) do
    if Enum.all?(rules, fn {_k, v} -> is_map(v) end) do
      %{"global" => %{}, "cms" => rules}
      |> sanitize_passport_rules()
    else
      %{"global" => rules, "cms" => %{}}
      |> sanitize_passport_rules()
    end
  end

  defp normalize_passport_rules(_), do: %{"global" => %{}, "cms" => %{}}

  defp sanitize_passport_rules(%{"global" => global, "cms" => cms}) do
    %{
      "global" => filter_global_rule_map(global),
      "cms" =>
        cms
        |> Enum.reduce(%{}, fn {community, rules}, acc ->
          Map.put(acc, community, filter_cms_rule_map(rules))
        end)
    }
  end

  defp filter_global_rule_map(map) when is_map(map) do
    map
    |> Enum.reduce(%{}, fn {rule, value}, acc ->
      if PermissionRegistry.valid_global_permission?(to_string(rule)) and value == true do
        Map.put(acc, to_string(rule), true)
      else
        acc
      end
    end)
  end

  defp filter_global_rule_map(_), do: %{}

  defp filter_cms_rule_map(map) when is_map(map) do
    map
    |> Enum.reduce(%{}, fn {rule, value}, acc ->
      if PermissionRegistry.valid_context_permission?("cms", to_string(rule)) and value == true do
        Map.put(acc, to_string(rule), true)
      else
        acc
      end
    end)
  end

  defp filter_cms_rule_map(_), do: %{}
end
