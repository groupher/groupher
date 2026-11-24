defmodule GroupherServerWeb.Middleware.PassportTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, ErrorCat, Repo}
  alias CMS.Model.{CommunityAdmin, GlobalPassport}
  alias GroupherServerWeb.Middleware.{FrontDesk, Passport}

  test "registered Global actions use stored grants and ignore stale god passport data" do
    {:ok, user} = db_insert(:user)
    actor = Map.put(user, :cur_passport, %{"global" => %{"god" => true}})

    assert_denied(call_middleware("community.create", actor, %{}))

    global_passport =
      %GlobalPassport{}
      |> GlobalPassport.changeset(%{
        user_id: user.id,
        is_root: false,
        permissions: %{"community.create" => true}
      })
      |> Repo.insert!()

    assert call_middleware("community.create", actor, %{}).errors == []

    global_passport
    |> GlobalPassport.changeset(%{permissions: %{}})
    |> Repo.update!()

    assert_denied(call_middleware("community.create", actor, %{}))
  end

  test "registered Community actions use stored grants and ignore stale root passport data" do
    {community, _article, _attrs, _owner} = mock_article(:post)
    {:ok, user} = db_insert(:user)

    actor =
      Map.put(user, :cur_passport, %{
        "global" => %{"god" => true},
        community.slug => %{
          "root" => true,
          "cms" => %{"review.read" => true}
        }
      })

    arguments = %{community: community.slug}
    assert_denied(call_middleware("review.read", actor, arguments))

    community_admin =
      %CommunityAdmin{}
      |> CommunityAdmin.changeset(%{
        user_id: user.id,
        community_id: community.id,
        permissions: %{"review.read" => true}
      })
      |> Repo.insert!()

    assert call_middleware("review.read", actor, arguments).errors == []

    community_admin
    |> CommunityAdmin.changeset(%{permissions: %{}})
    |> Repo.update!()

    assert_denied(call_middleware("review.read", actor, arguments))
  end

  test "pass_scope exposes the typed Community scope only after the action is allowed" do
    {community, _article, _attrs, _owner} = mock_article(:post)
    {:ok, user} = db_insert(:user)

    %CommunityAdmin{}
    |> CommunityAdmin.changeset(%{
      user_id: user.id,
      community_id: community.id,
      permissions: %{"audit.read" => true}
    })
    |> Repo.insert!()

    resolution =
      call_middleware("audit.read", user, %{community: community.slug}, pass_scope: true)

    assert resolution.errors == []

    assert %CMS.Passport.Scope.Community{
             actor_id: actor_id,
             community_id: community_id
           } = get_in(resolution.arguments, [:passport_scopes, :community])

    assert actor_id == user.id
    assert community_id == community.id

    assert %{community: community.slug} ==
             call_middleware("audit.read", user, %{community: community.slug}).arguments

    resolved = FrontDesk.call(resolution, :community)
    assert resolved.errors == []
    assert resolved.arguments.community.id == community.id

    assert get_in(resolved.arguments, [:passport_scopes, :community]) ==
             get_in(resolution.arguments, [:passport_scopes, :community])
  end

  test "retired ordinary Article actions reject stale legacy Passport grants" do
    {community, _article, _attrs, user} = mock_article(:post)

    actor =
      Map.put(user, :cur_passport, %{
        "global" => %{},
        community.slug => %{"cms" => %{"post.edit" => true}}
      })

    assert_denied(
      call_middleware("post.update", actor, %{community: community.slug}),
      4352
    )
  end

  defp call_middleware(action, actor, arguments, opts \\ []) do
    resolution = %Absinthe.Resolution{
      arguments: arguments,
      context: %{cur_user: actor},
      errors: [],
      value: nil
    }

    Passport.call(resolution, Keyword.merge([action: action], opts))
  end

  defp assert_denied(%Absinthe.Resolution{} = resolution, code \\ 4353) do
    assert [%ErrorCat.Error{namespace: {:cms, :passport}, code: ^code}] = resolution.errors
  end
end
