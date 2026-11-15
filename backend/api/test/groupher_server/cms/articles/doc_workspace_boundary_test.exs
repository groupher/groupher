defmodule GroupherServer.Test.CMS.Articles.DocWorkspaceBoundaryTest do
  use GroupherServer.TestMate

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.WorkingCopy.{Snapshotter, Store}
  alias CMS.Model.{Article, ArticleWorkingCopy}

  test "generic Article reads and commands cannot expose or mutate Doc workspace copies" do
    {community, doc, _attrs, actor} = mock_article(:doc)
    article = Repo.get!(Article, doc.article_id)

    assert {:ok, {default, workspace, snapshot}} =
             Repo.transaction(fn ->
               {:ok, default} =
                 Store.create_loaded(
                   article,
                   %{scope_type: :default, scope_id: article.id, title: "Default"},
                   actor,
                   community.id
                 )

               {:ok, workspace} =
                 Store.create_loaded(
                   article,
                   %{scope_type: :workspace, scope_id: Ecto.UUID.generate(), title: "Private"},
                   actor,
                   community.id
                 )

               {:ok, snapshot} =
                 Snapshotter.freeze_in_transaction(
                   workspace.id,
                   workspace.revision,
                   actor,
                   Ecto.UUID.generate()
                 )

               {default, workspace, snapshot}
             end)

    assert {:ok, [returned]} = CMS.Articles.working_copies(article, community)
    assert returned.id == default.id
    assert {:ok, []} = CMS.Articles.snapshots(article, community)
    assert {:error, missing_snapshot} = CMS.Articles.snapshot(article, community, snapshot.id)
    assert CMS.ErrorCat.code(missing_snapshot) == 4567

    command_id = Ecto.UUID.generate()

    assert {:ok, saved} =
             CMS.Articles.save_working_copy(
               article,
               community,
               default.id,
               %{title: "Updated default"},
               default.revision,
               actor,
               command_id
             )

    assert saved.title == "Updated default"

    assert {:ok, replayed} =
             CMS.Articles.save_working_copy(
               article,
               community,
               default.id,
               %{title: "Updated default"},
               default.revision,
               actor,
               command_id
             )

    assert replayed.id == default.id

    assert {:error, error} =
             CMS.Articles.save_working_copy(
               article,
               community,
               workspace.id,
               %{title: "bad"},
               workspace.revision,
               actor,
               Ecto.UUID.generate()
             )

    assert CMS.ErrorCat.code(error) == 4566
    assert Repo.get!(ArticleWorkingCopy, workspace.id).title == "Private"

    for work <- [default, workspace] do
      assert {:error, error} =
               CMS.Articles.delete_working_copy(
                 article,
                 community,
                 work.id,
                 actor,
                 Ecto.UUID.generate()
               )

      assert CMS.ErrorCat.code(error) == 4566
      assert Repo.get(ArticleWorkingCopy, work.id)
    end

    assert {:error, error} =
             CMS.Articles.fork_snapshot(
               snapshot.id,
               community,
               :workspace,
               Ecto.UUID.generate(),
               actor,
               Ecto.UUID.generate()
             )

    assert CMS.ErrorCat.code(error) == 4566

    assert {:error, error} =
             CMS.Articles.publish_article(
               article,
               community,
               %{snapshot_id: snapshot.id},
               nil,
               actor,
               Ecto.UUID.generate()
             )

    assert CMS.ErrorCat.code(error) == 4566

    {:ok, editor} = db_insert(:user)

    assert {:ok, _passport} =
             CMS.Passport.stamp_passport(
               %{"global" => %{}, community.slug => %{"cms" => %{"doc.edit" => true}}},
               editor
             )

    conn = simu_conn(:user, editor)

    assert [%{"id" => default_id, "title" => "Updated default"}] =
             gq_query(
               conn,
               """
               query DocCopies($articleId: ID!, $community: String!) {
                 articleWorkingCopies(articleId: $articleId, community: $community) { id title }
               }
               """,
               %{articleId: article.id, community: community.slug}
             )

    assert default_id == default.id

    assert [] =
             gq_query(
               conn,
               """
               query DocSnapshots($articleId: ID!, $community: String!) {
                 articleSnapshots(articleId: $articleId, community: $community) { id }
               }
               """,
               %{articleId: article.id, community: community.slug}
             )

    response =
      conn
      |> post("/graphiql",
        query: """
        query DocSnapshot($articleId: ID!, $snapshotId: ID!, $community: String!) {
          articleSnapshot(articleId: $articleId, snapshotId: $snapshotId, community: $community) { id bodyJson }
        }
        """,
        variables: %{articleId: article.id, snapshotId: snapshot.id, community: community.slug}
      )
      |> json_response(200)

    assert %{"data" => %{"articleSnapshot" => nil}, "errors" => [_ | _]} = response
    refute inspect(response) =~ "Private"

    save_query = """
    mutation SaveDoc($articleId: ID!, $workingCopyId: ID!, $revision: Int!, $community: String!, $commandId: ID!) {
      saveWorkingCopy(articleId: $articleId, workingCopyId: $workingCopyId, revision: $revision, community: $community, title: "editor save", commandId: $commandId) { id title }
    }
    """

    save_variables = %{
      articleId: article.id,
      workingCopyId: default.id,
      revision: saved.revision,
      community: community.slug,
      commandId: Ecto.UUID.generate()
    }

    assert %{"title" => "editor save"} =
             gq_mutation(simu_conn(:user, editor), save_query, save_variables)

    workspace_attempt =
      simu_conn(:user, editor)
      |> post("/graphiql",
        query: save_query,
        variables: %{
          save_variables
          | workingCopyId: workspace.id,
            revision: workspace.revision,
            commandId: Ecto.UUID.generate()
        }
      )
      |> json_response(200)

    assert %{"data" => %{"saveWorkingCopy" => nil}, "errors" => [_ | _]} = workspace_attempt
    assert Repo.get!(ArticleWorkingCopy, workspace.id).title == "Private"

    assert {:ok, _} =
             CMS.Passport.stamp_passport(
               %{"global" => %{}, community.slug => %{"cms" => %{"doc.edit" => false}}},
               editor
             )

    replay =
      simu_conn(:user, editor)
      |> post("/graphiql", query: save_query, variables: save_variables)
      |> json_response(200)

    assert %{"data" => %{"saveWorkingCopy" => nil}, "errors" => [_ | _]} = replay
    refute inspect(replay) =~ "editor save"
  end
end
