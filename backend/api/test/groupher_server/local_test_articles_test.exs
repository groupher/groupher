for file <- [
      "local_test_actors/guard.ex",
      "local_test_actors/communities.ex",
      "local_test_actors/grants.ex",
      "local_test_actors/cleanup.ex",
      "local_test_actors/articles.ex",
      "local_test_actors.ex"
    ] do
  Code.require_file("../../dev/" <> file, __DIR__)
end

defmodule GroupherServer.LocalTestArticlesTest do
  use GroupherServer.TestMate, async: false
  alias GroupherServer.{Accounts, CMS, LocalTestActors, Repo}
  alias Accounts.Model.OauthProvider
  alias CMS.Model.ArticleWorkingCopy
  alias LocalTestActors.Articles

  test "preparation persists one retry identity and refuses different content under the same key" do
    {community, _, _, owner} = mock_article(:post)
    register(owner)

    input = %{
      "alias" => "owner",
      "community" => community.slug,
      "thread" => "post",
      "key" => "primary"
    }

    assert {:ok, first} =
             Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)

    assert first.ownerLogin == owner.login
    assert first.command.action == "article.create"

    assert {:ok, again} =
             Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)

    assert first.command.commandId == again.command.commandId

    assert {:error, :local_test_article_fixture_conflict} =
             Repo.transact_result(fn ->
               Articles.prepare("article-fixture-test", Map.put(input, "title", "Changed"))
             end)

    assert {:ok, second} =
             Repo.transact_result(fn ->
               Articles.prepare("article-fixture-test", %{input | "key" => "second"})
             end)

    refute first.command.commandId == second.command.commandId
    assert {:ok, report} = LocalTestActors.Cleanup.report("article-fixture-test")
    assert length(report.article_fixtures_retained) == 2
    assert Enum.all?(report.article_fixtures_retained, &(&1["status"] == "pending"))
  end

  test "a fixture cannot adopt an existing Article from a different creation command" do
    {community, public, _, owner} = mock_article(:post)
    register(owner)
    work = Repo.get_by!(ArticleWorkingCopy, article_id: public.id, scope_type: :default)
    input = %{"alias" => "owner", "community" => community.slug, "thread" => "post"}

    assert {:ok, _} =
             Repo.transact_result(fn -> Articles.prepare("article-fixture-test", input) end)

    assert {:error, :local_test_article_provenance_mismatch} =
             Repo.transact_result(fn ->
               Articles.record(
                 "article-fixture-test",
                 Map.merge(input, %{"articleId" => public.id, "workingCopyId" => work.id})
               )
             end)

    assert Repo.get!(ArticleWorkingCopy, work.id).article_id == public.id
  end

  test "unsupported threads and identities are rejected without allocating an intent" do
    assert {:error, :local_test_article_requires_post_and_community} =
             Articles.prepare("article-fixture-test", %{
               "alias" => "owner",
               "community" => "home",
               "thread" => "doc"
             })

    assert {:error, :local_test_actor_unavailable} =
             Articles.prepare("article-fixture-test", %{
               "alias" => "unknown",
               "community" => "home",
               "thread" => "post"
             })

    assert LocalTestActors.bindings("article-fixture-test") == []
  end

  defp register(user) do
    Repo.insert!(%OauthProvider{
      provider: "local-test-actor-v1",
      provider_id: "article-fixture-test/owner",
      user_id: user.id,
      public_ref: "oauth_" <> Ecto.UUID.generate(),
      raw: %{
        "tool" => "local-test-actor-v1",
        "run" => "article-fixture-test",
        "alias" => "owner",
        "status" => "active",
        "communities" => []
      }
    })
  end
end
