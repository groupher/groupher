# Load fixture helpers only into this test VM; production compilation excludes dev/.
for file <- [
      "local_test_actors/guard.ex",
      "local_test_actors.ex",
      "local_test_actors/communities.ex",
      "local_test_actors/articles.ex",
      "local_test_actors/grants.ex",
      "local_test_actors/cleanup.ex"
    ] do
  Code.require_file("../../dev/" <> file, __DIR__)
end

defmodule GroupherServer.LocalTestActorsGrantsTest do
  use GroupherServer.TestMate, async: false
  alias GroupherServer.{Accounts, CMS, Repo, LocalTestActors}
  alias Accounts.Model.OauthProvider
  alias CMS.Model.{Article, ArticleCoAuthor, ArticleCoAuthorEvent, ArticleCoAuthorRequest, Author}
  alias LocalTestActors.Grants

  @permissions %{"article.read_draft" => true, "article.update" => true}

  test "clean refuses an account linked to another OAuth identity without closing it" do
    {:ok, user} = db_insert(:user)
    register(user, "linked")

    Repo.insert!(%OauthProvider{
      provider: "github",
      provider_id: "external-#{user.id}",
      user_id: user.id,
      public_ref: "oauth_" <> Ecto.UUID.generate()
    })

    assert {:ok, %{status: "blocked", blockers: ["unexpected_oauth_identity"]}} =
             LocalTestActors.Cleanup.apply("fixture-test")

    assert {:ok, _, _} = LocalTestActors.actor("fixture-test", "linked")
  end

  test "clean report is read-only; apply removes only run grants and retains shared community/content" do
    {community, public, _, owner} = mock_article(:post)
    {:ok, subject} = db_insert(:user)

    if root = Repo.get_by(CMS.Model.GlobalPassport, user_id: owner.id) do
      Repo.delete!(root)
    end

    register(owner, "owner")
    register(subject, "editor")

    input = %{
      "alias" => "editor",
      "by" => "owner",
      "article" => public.id,
      "permissions" => @permissions
    }

    assert {:ok, _} = Repo.transact_result(fn -> Grants.configure("fixture-test", input) end)
    assert {:ok, plan} = LocalTestActors.Cleanup.report("fixture-test")
    assert plan.coauthors == 1
    assert plan.communities_to_archive == []
    assert LocalTestActors.actor("fixture-test", "editor") |> elem(0) == :ok

    assert {:ok, %{status: "cleaned", coauthors: 0, admins: 0}} =
             LocalTestActors.Cleanup.apply("fixture-test")

    assert Repo.get!(CMS.Model.Community, community.id)
    assert Repo.get!(Article, public.id)
    assert Repo.get!(Accounts.Model.User, subject.id)

    assert Repo.get_by(ArticleCoAuthorEvent,
             article_id: public.id,
             subject_user_id: subject.id,
             type: :exit
           )

    assert {:error, :local_test_actor_unavailable} =
             LocalTestActors.actor("fixture-test", "editor")

    assert {:ok, %{status: "cleaned"}} = LocalTestActors.Cleanup.apply("fixture-test")
  end

  test "local lord initialization is scoped, idempotent and refuses ordinary Admin promotion" do
    {community, _, _, _} = mock_article(:post)
    {:ok, subject} = db_insert(:user)
    register(subject, "lord")
    input = %{"alias" => "lord", "community" => community.slug, "role" => "lord"}

    assert {:ok, %{isLord: true}} =
             Repo.transact_result(fn -> Grants.configure("fixture-test", input) end)

    assert {:ok, %{isLord: true}} =
             Repo.transact_result(fn -> Grants.configure("fixture-test", input) end)

    assert {:ok, facts} = CMS.Passport.community_facts(subject.id, community.id)
    assert facts.is_lord
    assert facts.revision == 1
    assert LocalTestActors.Communities.memberships(subject) |> length() == 1

    {:ok, ordinary} = db_insert(:user)
    register(ordinary, "ordinary")

    member =
      Repo.insert!(
        CMS.Model.CommunityAdmin.changeset(%CMS.Model.CommunityAdmin{}, %{
          user_id: ordinary.id,
          community_id: community.id,
          permissions: %{}
        })
      )

    assert {:error, :local_test_refuses_implicit_lord_promotion} =
             Repo.transact_result(fn ->
               Grants.configure("fixture-test", %{input | "alias" => "ordinary"})
             end)

    refute Repo.get!(CMS.Model.CommunityAdmin, member.id).is_lord
  end

  test "co-author setup records real request, membership, event and scoped permission facts" do
    {_community, public, _, owner} = mock_article(:post)
    {:ok, subject} = db_insert(:user)
    register(owner, "owner")
    register(subject, "editor")
    article = Repo.get!(Article, public.id) |> Repo.preload(:author)

    input = %{
      "alias" => "editor",
      "by" => "owner",
      "article" => article.id,
      "permissions" => @permissions
    }

    assert {:ok, _} = Repo.transact_result(fn -> Grants.configure("fixture-test", input) end)

    request =
      Repo.get_by!(ArticleCoAuthorRequest, article_id: article.id, subject_user_id: subject.id)

    assert request.status == :decided and request.decision == :accept
    author = Repo.get_by!(Author, user_id: subject.id)
    member = Repo.get_by!(ArticleCoAuthor, article_id: article.id, author_id: author.id)
    assert member.permissions == @permissions

    assert Repo.get_by(ArticleCoAuthorEvent,
             article_id: article.id,
             member_id: member.id,
             type: :join
           )

    assert {:ok, scope} = CMS.Passport.load_article_scope(subject, article)
    assert {:ok, true} = CMS.Passport.allowed?(subject, scope, "article.update")
    assert {:ok, false} = CMS.Passport.allowed?(subject, scope, "article.publish")

    assert {:error, :permission_dependency_missing} =
             Repo.transact_result(fn ->
               Grants.configure("fixture-test", %{
                 input
                 | "permissions" => %{"article.update" => true}
               })
             end)

    assert Repo.get!(ArticleCoAuthor, member.id).permissions == @permissions
  end

  test "pending co-author setup leaves permission facts unchanged until acceptance" do
    {_community, public, _, owner} = mock_article(:post)
    {:ok, subject} = db_insert(:user)
    register(owner, "owner")
    register(subject, "editor")

    input = %{
      "alias" => "editor",
      "by" => "owner",
      "article" => public.id,
      "permissions" => @permissions,
      "pending" => true
    }

    assert {:ok, %{status: "pending"}} =
             Repo.transact_result(fn -> Grants.configure("fixture-test", input) end)

    request =
      Repo.get_by!(ArticleCoAuthorRequest, article_id: public.id, subject_user_id: subject.id)

    assert request.status == :pending
    refute Repo.get_by(Author, user_id: subject.id)
  end

  defp register(user, name) do
    Repo.insert!(%OauthProvider{
      provider: "local-test-actor-v1",
      provider_id: "fixture-test/#{name}",
      user_id: user.id,
      public_ref: "oauth_" <> Ecto.UUID.generate(),
      raw: %{
        "tool" => "local-test-actor-v1",
        "run" => "fixture-test",
        "alias" => name,
        "status" => "active",
        "communities" => []
      }
    })
  end
end
