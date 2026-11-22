defmodule GroupherServer.Test.CMS.DocTree.CoauthorQueueAccessTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.CoAuthors.Commands.{CreateRequest, DecideRequest, RemoveMember}
  alias CMS.Articles.Commands.{ForkSnapshot, SaveWorkingCopy}
  alias CMS.DocTree.Commands.{BeginEdit, Enqueue, MergeQueue, QueueAccess, SaveQueue}
  alias CMS.DocTree.Publish.Queue

  alias CMS.Model.{Article, ArticleCoAuthor, ArticleWorkingCopy, DocsQueueArticle}

  @permissions %{"article.read_draft" => true, "article.update" => true}

  test "co-author reads and saves only the existing Queue copy for the granted Doc" do
    fixture = doc_with_queue_member()
    {coauthor, _member} = grant_coauthor(fixture)

    assert {:ok, %{queue_revision: queue_revision, working_copy: work}} =
             QueueAccess.read_member(fixture.community, fixture.article_id, coauthor)

    assert work.id == fixture.member.working_copy_id
    assert work.scope_type == :workspace

    assert {:ok, %{queue_revision: saved_queue_revision, working_copy_revision: saved_revision}} =
             SaveQueue.execute(
               fixture.community,
               queue_revision,
               fixture.article_id,
               work.revision,
               %{title: "Co-author Queue edit"},
               coauthor,
               Ecto.UUID.generate()
             )

    assert saved_queue_revision > queue_revision
    assert saved_revision > work.revision
    assert Repo.get!(ArticleWorkingCopy, work.id).title == "Co-author Queue edit"

    assert {:ok, _merged} =
             MergeQueue.execute(
               fixture.community,
               saved_queue_revision,
               fixture.article_id,
               fixture.default_work.revision,
               saved_revision,
               %{},
               coauthor,
               Ecto.UUID.generate()
             )
  end

  test "co-author cannot read or save a Queue member from another Doc" do
    fixture = doc_with_queue_member()
    other = doc_with_queue_member()
    {coauthor, _member} = grant_coauthor(fixture)

    assert {:error, _} = QueueAccess.read_member(other.community, other.article_id, coauthor)

    assert {:error, _} =
             SaveQueue.execute(
               other.community,
               other.queue.queue_revision,
               other.article_id,
               other.work.revision,
               %{title: "Unauthorized edit"},
               coauthor,
               Ecto.UUID.generate()
             )

    assert Repo.get!(ArticleWorkingCopy, other.work.id).title == other.work.title
  end

  test "Queue editor read requires read_draft even when a malformed grant retains update" do
    fixture = doc_with_queue_member()
    {coauthor, member} = grant_coauthor(fixture)

    Repo.update_all(
      from(row in ArticleCoAuthor, where: row.id == ^member.id),
      set: [permissions: %{"article.update" => true}]
    )

    assert {:error, _} = QueueAccess.read_member(fixture.community, fixture.article_id, coauthor)
  end

  test "co-author cannot use legacy default-copy reader, save, begin-edit, or fork paths" do
    fixture = doc_with_queue_member()
    {coauthor, _member} = grant_coauthor(fixture)

    assert {:ok, %{errors: [_ | _], data: nil}} =
             Absinthe.run(
               """
               query DefaultCopies($articleId: ID!, $community: String!) {
                 articleWorkingCopies(articleId: $articleId, community: $community) { id title }
               }
               """,
               GroupherServerWeb.Schema,
               variables: %{
                 "articleId" => fixture.article_id,
                 "community" => fixture.community.slug
               },
               context: %{cur_user: coauthor}
             )

    assert {:ok, %{errors: [_ | _], data: %{"docsEditor" => nil}}} =
             Absinthe.run(
               """
               query DocsEditor($articleId: ID!, $community: String!) {
                 docsEditor(articleId: $articleId, community: $community) { workingCopy { id } }
               }
               """,
               GroupherServerWeb.Schema,
               variables: %{
                 "articleId" => fixture.article_id,
                 "community" => fixture.community.slug
               },
               context: %{cur_user: coauthor}
             )

    save_query = """
    mutation SaveDefaultDocCopy(
      $articleId: ID!,
      $workingCopyId: ID!,
      $revision: Int!,
      $community: String!,
      $commandId: ID!
    ) {
      saveWorkingCopy(
        articleId: $articleId,
        workingCopyId: $workingCopyId,
        revision: $revision,
        community: $community,
        title: "Bypass Queue",
        commandId: $commandId
      ) { id title }
    }
    """

    mutation_result =
      :user
      |> simu_conn(coauthor)
      |> post("/graphiql",
        query: save_query,
        variables: %{
          articleId: fixture.article_id,
          workingCopyId: fixture.default_work.id,
          revision: fixture.default_work.revision,
          community: fixture.community.slug,
          commandId: Ecto.UUID.generate()
        }
      )
      |> json_response(200)

    assert %{"data" => %{"saveWorkingCopy" => nil}, "errors" => [_ | _]} = mutation_result

    assert {:error, _} =
             SaveWorkingCopy.execute(
               Repo.get!(Article, fixture.article_id),
               fixture.community,
               fixture.default_work.id,
               %{title: "Bypass Queue"},
               fixture.default_work.revision,
               coauthor,
               Ecto.UUID.generate()
             )

    assert {:error, _} =
             BeginEdit.execute(
               fixture.community,
               fixture.article_id,
               fixture.public_snapshot_id,
               coauthor,
               Ecto.UUID.generate()
             )

    assert {:error, _} =
             ForkSnapshot.execute(
               fixture.public_snapshot_id,
               fixture.community,
               :default,
               fixture.article_id,
               coauthor,
               Ecto.UUID.generate()
             )

    assert {:error, _} =
             CMS.DocTree.Commands.RestoreSnapshot.execute(
               fixture.community,
               fixture.article_id,
               fixture.public_snapshot_id,
               fixture.default_work.id,
               fixture.default_work.revision,
               coauthor,
               Ecto.UUID.generate()
             )

    assert Repo.get!(ArticleWorkingCopy, fixture.default_work.id).title ==
             fixture.default_work.title
  end

  test "co-author body access does not grant Enqueue or Queue Release" do
    fixture = doc_with_queue_member()
    {coauthor, _member} = grant_coauthor(fixture)

    assert {:error, _} =
             Enqueue.execute(
               fixture.community,
               fixture.queue.queue_revision,
               [%{article_id: fixture.article_id, default_revision: fixture.work.revision}],
               coauthor,
               Ecto.UUID.generate()
             )

    assert {:error, _} =
             CMS.DocTree.Commands.ReleaseQueue.execute(
               fixture.community,
               fixture.queue.queue_revision,
               coauthor,
               Ecto.UUID.generate()
             )
  end

  test "removing the co-author revokes Queue read and save admission" do
    fixture = doc_with_queue_member()
    {coauthor, member} = grant_coauthor(fixture)

    assert {:ok, _} =
             RemoveMember.execute(
               Repo.get!(Article, fixture.article_id),
               member.id,
               member.revision,
               fixture.actor,
               Ecto.UUID.generate()
             )

    assert {:error, _} = QueueAccess.read_member(fixture.community, fixture.article_id, coauthor)

    assert {:error, _} =
             SaveQueue.execute(
               fixture.community,
               fixture.queue.queue_revision,
               fixture.article_id,
               fixture.work.revision,
               %{title: "Edit after removal"},
               coauthor,
               Ecto.UUID.generate()
             )

    assert Repo.get!(ArticleWorkingCopy, fixture.work.id).title == fixture.work.title
  end

  defp grant_coauthor(fixture) do
    article = Repo.get!(Article, fixture.article_id) |> Repo.preload(:author)
    {:ok, coauthor} = db_insert(:user)

    assert {:ok, request} =
             CreateRequest.execute(
               article,
               coauthor,
               :invite,
               @permissions,
               fixture.actor,
               Ecto.UUID.generate()
             )

    assert {:ok, {_decided, member}} =
             DecideRequest.execute(
               article,
               request.id,
               request.revision,
               :accept,
               @permissions,
               coauthor,
               Ecto.UUID.generate()
             )

    {coauthor, member}
  end

  defp doc_with_queue_member do
    {community, public, _, actor} = mock_article(:doc)

    assert {:ok, opened} =
             BeginEdit.execute(
               community,
               public.id,
               public.snapshot_id,
               actor,
               Ecto.UUID.generate()
             )

    work = Repo.get!(ArticleWorkingCopy, opened.working_copy_id)
    assert {:ok, queue} = Queue.read(community)

    assert {:ok, _} =
             Enqueue.execute(
               community,
               queue.queue_revision,
               [%{article_id: public.id, default_revision: work.revision}],
               actor,
               Ecto.UUID.generate()
             )

    assert {:ok, queue} = Queue.read(community)
    member = Repo.get_by!(DocsQueueArticle, queue_id: queue.id, article_id: public.id)

    %{
      community: community,
      actor: actor,
      article_id: public.id,
      public_snapshot_id: public.snapshot_id,
      default_work: work,
      queue: queue,
      member: member,
      work: Repo.get!(ArticleWorkingCopy, member.working_copy_id)
    }
  end
end
