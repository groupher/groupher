defmodule GroupherServerWeb.Middleware.PassportTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, ErrorCat, Repo}
  alias CMS.Model.{CommunityAdmin, GlobalPassport}
  alias GroupherServerWeb.Middleware.Passport

  test "registered Global actions use stored grants and ignore stale god passport data" do
    {:ok, user} = db_insert(:user)
    actor = %{user | cur_passport: %{"global" => %{"god" => true}}}

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

    actor = %{
      user
      | cur_passport: %{
          "global" => %{"god" => true},
          community.slug => %{
            "root" => true,
            "cms" => %{"review.read" => true}
          }
        }
    }

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

  test "actions in an unmigrated scope retain their Registry fallback" do
    {community, _article, _attrs, user} = mock_article(:post)

    actor = %{
      user
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => %{"post.edit" => true}}
        }
    }

    assert call_middleware("post.update", actor, %{community: community.slug}).errors == []
  end

  defp call_middleware(action, actor, arguments) do
    resolution = %Absinthe.Resolution{
      arguments: arguments,
      context: %{cur_user: actor},
      errors: [],
      value: nil
    }

    Passport.call(resolution, action: action)
  end

  defp assert_denied(%Absinthe.Resolution{} = resolution) do
    assert [%ErrorCat.Error{namespace: {:cms, :passport}, code: 4353}] = resolution.errors
  end
end
