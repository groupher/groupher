defmodule GroupherServer.TestWeb.CommunityAdmissionConflictTest do
  use ExUnit.Case, async: false

  import GroupherServer.Support.Factory
  import GroupherServer.Test.ConnSimulator
  import Phoenix.ConnTest
  import Plug.Conn

  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleWorkingCopy}
  @endpoint GroupherServerWeb.Endpoint

  @query """
  mutation SaveWorkingCopy($articleId: ID!, $workingCopyId: ID!, $revision: Int!, $community: String!, $title: String!, $bodyBag: ArtimentBodyBagInput!, $commandId: ID!) {
    saveWorkingCopy(articleId: $articleId, workingCopyId: $workingCopyId, revision: $revision, community: $community, title: $title, bodyBag: $bodyBag, commandId: $commandId) { id revision title }
  }
  """

  @tag timeout: 60_000
  test "real GraphQL mutation returns 4635 and same command id succeeds after a retry" do
    Sandbox.unboxed_run(Repo, fn ->
      {community, public, _, author} = mock_article(:post)
      {:ok, destination} = mock_community(author)
      article = Repo.get!(Article, public.id)
      work = Repo.get_by!(ArticleWorkingCopy, article_id: article.id)
      parent = self()

      for site <- [community, destination] do
        {:ok, _} =
          GroupherServer.Test.PassportFixture.grant_community(author, site.slug, %{
            "article.mirror" => true,
            "post.pin" => true
          })
      end

      actor = author

      variables = %{
        articleId: article.id,
        workingCopyId: work.id,
        revision: work.revision,
        community: community.slug,
        title: "GraphQL retry",
        bodyBag:
          mock_body_bag(mock_rich_text("GraphQL retry body"))
          |> Map.update!(:thumbnail, &Jason.encode!/1),
        commandId: Ecto.UUID.generate()
      }

      try do
        mirror =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              Repo.transaction(fn ->
                {:ok, _} =
                  CMS.Articles.mirror(
                    destination,
                    article.id,
                    [],
                    actor,
                    community,
                    Ecto.UUID.generate()
                  )

                send(parent, {:mirror_written, self()})

                receive do
                  :commit -> :committed
                after
                  10_000 -> Repo.rollback(:timeout)
                end
              end)
            end)
          end)

        assert_receive {:mirror_written, pid}, 10_000

        saving =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn ->
              conn =
                simu_conn(:user, author)
                |> put_req_header("x-groupher-test-service-auth", "enabled")

              send(parent, :saving)
              conn |> post("/graphiql", query: @query, variables: variables) |> json_response(200)
            end)
          end)

        assert_receive :saving, 10_000

        probe =
          Task.async(fn ->
            Sandbox.unboxed_run(Repo, fn -> await_advisory_wait(100) end)
          end)

        assert :waiting = Task.await(probe, 10_000)
        send(pid, :commit)
        assert {:ok, :committed} = Task.await(mirror, 15_000)

        assert %{
                 "errors" => [
                   %{
                     "extensions" => %{
                       "code" => 4635,
                       "retryable" => true,
                       "actions" => ["RETRY"]
                     }
                   }
                   | _
                 ]
               } = Task.await(saving, 15_000)

        assert Repo.get!(ArticleWorkingCopy, work.id).revision == work.revision

        conn =
          simu_conn(:user, author) |> put_req_header("x-groupher-test-service-auth", "enabled")

        result =
          conn |> post("/graphiql", query: @query, variables: variables) |> json_response(200)

        assert %{
                 "data" => %{
                   "saveWorkingCopy" => %{"revision" => revision, "title" => "GraphQL retry"}
                 }
               } = result

        assert revision == work.revision + 1
      after
        CMS.Seeds.FullCommunity.delete(community.slug)
        CMS.Seeds.FullCommunity.delete(destination.slug)
      end
    end)
  end

  defp await_advisory_wait(0), do: :timeout

  defp await_advisory_wait(attempts) do
    {:ok, result} =
      Repo.query("""
        SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity
          WHERE datname = current_database()
            AND pid <> pg_backend_pid()
            AND cardinality(pg_blocking_pids(pid)) > 0
        )
      """)

    if result.rows == [[true]] do
      :waiting
    else
      Process.sleep(25)
      await_advisory_wait(attempts - 1)
    end
  end
end
