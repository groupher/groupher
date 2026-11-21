defmodule GroupherServer.Test.ConnSimulator do
  @moduledoc """
  Builds authenticated and guest `Plug.Conn` fixtures for GraphQL endpoint tests.

  Authenticated variants create or accept a User, issue the legacy test token,
  and can stamp sanitized Passport rules for authorization scenarios.

  Business position:

      Test case
        -> ConnSimulator
        -> endpoint / fixture / Repo
  """
  import GroupherServer.Support.Factory
  import Ecto.Query, only: [from: 2]
  import Phoenix.ConnTest, only: [build_conn: 0]
  import Plug.Conn, only: [put_req_header: 3]

  import GroupherServer.FrontDesk, only: [article_author: 1]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Model.{Community, CommunityAdmin, GlobalPassport}
  alias Helper.{Guardian, ORM}

  @spec simu_conn(:guest | :invalid_token | :user) :: Plug.Conn.t()
  @doc "Builds a guest, generated-user, or invalid-token test connection."
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

  @doc "Builds an authenticated connection from content ownership, a User, or Passport rules."
  def simu_conn(:owner, content) do
    with {:ok, author} <- article_author(content) do
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

    stamp_test_passport!(user, passport_rules)

    build_conn() |> put_req_header("authorization", token)
  end

  @doc "Stamps CMS Passport rules for an existing user and returns its connection."
  def simu_conn(:user, %User{} = user, cms: passport_rules) do
    token = gen_jwt_token(id: user.id)

    stamp_test_passport!(user, passport_rules)

    build_conn() |> put_req_header("authorization", token)
  end

  defp gen_jwt_token(clauses) do
    with {:ok, user} <- ORM.find_by(User, clauses) do
      {:ok, token, _info} = Guardian.jwt_encode(user)

      "Bearer #{token}"
    end
  end

  defp stamp_test_passport!(%User{id: user_id} = user, rules) when is_map(rules) do
    {global, scoped, unscoped} = test_passport_rules(rules)
    is_root = test_system_root?(rules)
    current = Repo.get_by(GlobalPassport, user_id: user_id) || %GlobalPassport{}

    current
    |> GlobalPassport.changeset(%{
      user_id: user_id,
      is_root: is_root,
      permissions: global
    })
    |> Repo.insert_or_update!()

    stamp_community_passports!(user, scoped, unscoped)
  end

  defp test_passport_rules(rules) do
    rules = stringify_keys(rules)
    global_source = Map.get(rules, "global", %{})
    base_rules = Map.drop(rules, ["global", "god", "cms"])

    scoped_candidates =
      base_rules
      |> Enum.reject(fn {key, value} ->
        value == true and
          (global_permission?(key) or community_permission?(key))
      end)
      |> Enum.filter(fn {_key, value} -> is_map(value) end)

    {global, flat_context} =
      base_rules
      |> Enum.reduce({filter_global_rule_map(global_source), %{}}, fn {key, value},
                                                                      {global, cms} ->
        cond do
          value != true -> {global, cms}
          global_permission?(key) -> {Map.put(global, key, true), cms}
          community_permission?(key) -> {global, Map.put(cms, key, true)}
          true -> {global, cms}
        end
      end)

    legacy_cms = Map.get(rules, "cms", %{})

    {scoped_source, unscoped_source} =
      cond do
        is_map(legacy_cms) and map_size(legacy_cms) > 0 and
            Enum.all?(legacy_cms, fn {_key, value} -> is_map(value) end) ->
          {legacy_cms, %{}}

        is_map(legacy_cms) and map_size(legacy_cms) > 0 ->
          {%{}, Map.merge(flat_context, filter_community_rule_map(legacy_cms))}

        true ->
          {scoped_candidates, flat_context}
      end

    scoped =
      Enum.reduce(scoped_source, %{}, fn {slug, value}, acc ->
        value = stringify_keys(value)
        cms = Map.get(value, "cms", value)
        permissions = filter_community_rule_map(cms)
        is_lord = if Map.has_key?(value, "root"), do: Map.get(value, "root") == true
        Map.put(acc, to_string(slug), %{permissions: permissions, is_lord: is_lord})
      end)

    {global, scoped, filter_community_rule_map(unscoped_source)}
  end

  defp stamp_community_passports!(%User{id: user_id}, scoped, unscoped) do
    if map_size(unscoped) > 0 do
      Repo.all(Community)
      |> Enum.each(&upsert_test_membership!(user_id, &1, unscoped, false))
    end

    existing_members = Repo.all(from(member in CommunityAdmin, where: member.user_id == ^user_id))

    Enum.each(existing_members, fn member ->
      slug = community_slug(member.community_id)
      grant = Map.get(scoped, slug)
      has_grant = map_size(unscoped) > 0 or not is_nil(grant)

      permissions =
        member.permissions
        |> Map.merge(unscoped)
        |> Map.merge(if(grant, do: grant.permissions, else: %{}))

      is_lord = if grant && not is_nil(grant.is_lord), do: grant.is_lord, else: member.is_lord

      if has_grant do
        member
        |> CommunityAdmin.changeset(%{
          permissions: permissions,
          is_lord: is_lord
        })
        |> Repo.update!()
      end
    end)

    Enum.each(scoped, fn {slug, grant} ->
      case find_test_community(slug) do
        nil ->
          {:ok, :pass}

        community ->
          upsert_test_membership!(user_id, community, grant.permissions, grant.is_lord)
      end
    end)

    {:ok, :pass}
  end

  defp upsert_test_membership!(user_id, community, permissions, is_lord) do
    case Repo.get_by(CommunityAdmin, user_id: user_id, community_id: community.id) do
      nil when permissions == %{} and is_lord != true ->
        {:ok, :pass}

      member ->
        member = member || %CommunityAdmin{}
        next_is_lord = if is_nil(is_lord), do: member.is_lord || false, else: is_lord

        member
        |> CommunityAdmin.changeset(%{
          user_id: user_id,
          community_id: community.id,
          permissions: Map.merge(member.permissions || %{}, permissions),
          is_lord: next_is_lord
        })
        |> Repo.insert_or_update!()

        {:ok, :pass}
    end
  end

  defp community_slug(community_id) do
    Repo.get!(Community, community_id).slug
  end

  defp find_test_community(ref) do
    Repo.get_by(Community, slug: ref) || Repo.get_by(Community, title: ref)
  end

  defp test_system_root?(rules) do
    rules = stringify_keys(rules)
    Map.get(rules, "god") == true or Map.get(Map.get(rules, "global", %{}), "god") == true
  end

  defp filter_global_rule_map(map) when is_map(map) do
    Enum.reduce(map, %{}, fn {rule, value}, acc ->
      rule = to_string(rule)

      if global_permission?(rule) and value == true,
        do: Map.put(acc, rule, true),
        else: acc
    end)
  end

  defp filter_global_rule_map(_), do: %{}

  defp filter_community_rule_map(map) when is_map(map) do
    Enum.reduce(map, %{}, fn {rule, value}, acc ->
      rule = to_string(rule)

      valid? =
        community_permission?(rule) or
          CMS.Passport.Registry.valid_context_permission?(:cms, rule)

      if valid? and value == true, do: Map.put(acc, rule, true), else: acc
    end)
  end

  defp filter_community_rule_map(_), do: %{}

  defp community_permission?(rule) do
    case CMS.Passport.Catalog.get(rule) do
      {:ok, %{scope: :community, grantable: true}} -> true
      _ -> false
    end
  end

  defp global_permission?(rule) do
    case CMS.Passport.Catalog.get(rule) do
      {:ok, %{scope: :global, grantable: true}} -> true
      _ -> false
    end
  end

  defp stringify_keys(map) when is_map(map),
    do: Map.new(map, fn {key, value} -> {to_string(key), value} end)
end
