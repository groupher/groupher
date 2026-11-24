defmodule GroupherServer.Test.ConnSimulator do
  @moduledoc """
  Builds authenticated and guest `Plug.Conn` fixtures for GraphQL endpoint tests.

  Authenticated variants create or accept a User, issue the legacy test token,
  and can write canonical scoped Passport facts for authorization scenarios.

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

  @doc "Builds an authenticated connection from content ownership, a User, or scoped Passport facts."
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

  def simu_conn(:user, passport: passport_facts) do
    user_attr = mock_attrs(:user)
    {:ok, user} = db_insert(:user, user_attr)

    token = gen_jwt_token(id: user.id)

    stamp_test_passport!(user, passport_facts)

    build_conn() |> put_req_header("authorization", token)
  end

  @doc "Writes scoped Passport facts for an existing user and returns its connection."
  def simu_conn(:user, %User{} = user, passport: passport_facts) do
    token = gen_jwt_token(id: user.id)

    stamp_test_passport!(user, passport_facts)

    build_conn() |> put_req_header("authorization", token)
  end

  defp gen_jwt_token(clauses) do
    with {:ok, user} <- ORM.find_by(User, clauses) do
      {:ok, token, _info} = Guardian.jwt_encode(user)

      "Bearer #{token}"
    end
  end

  defp stamp_test_passport!(%User{id: user_id}, %{
         global: %{is_root: is_root, permissions: global},
         communities: communities,
         community_permissions: default_permissions
       })
       when is_boolean(is_root) and is_map(communities) do
    {:ok, global} = CMS.Passport.Catalog.validate_permissions(:global, global)
    {:ok, defaults} = CMS.Passport.Catalog.validate_permissions(:community, default_permissions)
    current = Repo.get_by(GlobalPassport, user_id: user_id) || %GlobalPassport{}

    current
    |> GlobalPassport.changeset(%{user_id: user_id, is_root: is_root, permissions: global})
    |> Repo.insert_or_update!()

    scoped =
      Map.new(communities, fn {slug, facts} ->
        community = Repo.get_by(Community, slug: slug) || Repo.get_by(Community, title: slug)
        if is_nil(community), do: raise("Passport fixture Community is missing: #{slug}")
        {community.id, facts}
      end)

    target_ids =
      if map_size(defaults) > 0,
        do: Repo.all(from(c in Community, select: c.id)),
        else: Map.keys(scoped)

    Enum.each(Enum.uniq(target_ids ++ Map.keys(scoped)), fn community_id ->
      facts = Map.get(scoped, community_id, %{permissions: %{}})

      current =
        Repo.get_by(CommunityAdmin, user_id: user_id, community_id: community_id) ||
          %CommunityAdmin{user_id: user_id, community_id: community_id}

      permissions = current.permissions |> Map.merge(defaults) |> Map.merge(facts.permissions)
      {:ok, permissions} = CMS.Passport.Catalog.validate_permissions(:community, permissions)

      current
      |> CommunityAdmin.changeset(%{
        permissions: permissions,
        is_lord: Map.get(facts, :is_lord, current.is_lord)
      })
      |> Repo.insert_or_update!()
    end)

    {:ok, :pass}
  end
end
