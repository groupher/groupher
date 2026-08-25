defmodule GroupherServer.Test.CMS.Comments.Commands.SolutionCommands do
  use GroupherServer.TestMate, async: false

  import Ecto.Query, warn: false

  alias GroupherServer.Activity.Model.PostLog
  alias GroupherServer.CMS.Comments.Lifecycle
  alias GroupherServer.CMS.Model.{Comment, CommentLifecycle, PinnedComment, Post, PostSolution}
  alias GroupherServer.Repo
  alias Helper.ORM

  @article_cat GroupherServer.CMS.Artiment.Const.cat_map()
  @article_status GroupherServer.CMS.Artiment.Const.status_map()

  setup do
    {community, post, _, actor} = mock_article(:post, preload: [author: :user])
    {:ok, post} = CMS.Articles.set_cat(post, @article_cat.qa)
    {:ok, post} = ORM.find(Post, post.id, preload: [author: :user])

    {:ok, first} =
      CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment("first"), actor)

    {:ok, second} =
      CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment("second"), actor)

    {:ok, outsider} = db_insert(:user)
    {:ok, ~m(community post actor outsider first second)a}
  end

  test "accept is idempotent and does not alter workflow status or pin", context do
    ~m(post actor first)a = context
    {:ok, post} = CMS.Articles.set_status(post, @article_status.wip)
    {:ok, pinned} = CMS.Comments.pin_comment(first.id, actor)
    assert pinned.is_pinned

    assert {:ok, %{is_solution: true}} = CMS.Comments.accept_solution(first.id, actor)
    assert {:ok, %{is_solution: true}} = CMS.Comments.accept_solution(first.id, actor)

    assert Repo.get_by!(PostSolution, post_id: post.id).comment_id == first.id
    assert Repo.get_by!(PinnedComment, comment_id: first.id)
    assert Repo.get!(Post, post.id).status == @article_status.wip

    assert Repo.aggregate(
             from(log in PostLog,
               where: log.post_ref == ^post.article_hash_id,
               where: log.action == :solution_accepted
             ),
             :count
           ) == 1
  end

  test "revoke without a current solution is side-effect-free", context do
    ~m(post actor first)a = context
    {:ok, _} = CMS.Articles.set_status(post, @article_status.done)
    {:ok, _} = CMS.Comments.pin_comment(first.id, actor)

    assert {:ok, %{is_solution: false}} = CMS.Comments.revoke_solution(first.id, actor)
    refute Repo.get_by(PostSolution, post_id: post.id)
    assert Repo.get_by!(PinnedComment, comment_id: first.id)
    assert Repo.get!(Post, post.id).status == @article_status.done
    refute Repo.get_by(PostLog, post_ref: post.article_hash_id, action: :solution_revoked)
  end

  test "revoke rejects a different comment without changing the relation", context do
    ~m(post actor first second)a = context
    {:ok, _} = CMS.Comments.accept_solution(first.id, actor)

    assert {:error, %{reason: :solution_target_mismatch}} =
             CMS.Comments.revoke_solution(second.id, actor)

    assert Repo.get_by!(PostSolution, post_id: post.id).comment_id == first.id
  end

  test "replace writes one relation and one replacement event", context do
    ~m(post actor first second)a = context
    {:ok, _} = CMS.Comments.accept_solution(first.id, actor)
    {:ok, _} = CMS.Comments.accept_solution(second.id, actor)

    assert Repo.get_by!(PostSolution, post_id: post.id).comment_id == second.id

    replacement =
      Repo.get_by!(PostLog, post_ref: post.article_hash_id, action: :solution_replaced)

    assert replacement.payload["previous_comment_ref"] == to_string(first.inner_id)
    refute Repo.get_by(PostLog, operation_ref: replacement.operation_ref, action: :comment_pinned)
  end

  test "non-author moderators and non-QA posts are rejected by the current author-only policy",
       context do
    ~m(community post actor outsider first)a = context

    assert {:ok, _community} = CMS.Communities.add_moderator(community, outsider, actor)

    assert {:error, %{reason: :permission_denied}} =
             CMS.Comments.accept_solution(first.id, outsider)

    assert {:error, %{reason: :permission_denied}} =
             CMS.Comments.revoke_solution(first.id, outsider)

    {:ok, _} = CMS.Articles.set_cat(post, @article_cat.idea)

    assert {:error, %{reason: :solution_not_supported}} =
             CMS.Comments.accept_solution(first.id, actor)

    refute Repo.get_by(PostSolution, post_id: post.id)
  end

  test "a suspended ancestor community rejects solution mutation", context do
    ~m(community actor first)a = context

    {:ok, _blocker} =
      CMS.Communities.Lifecycle.apply_blocker(
        community.slug,
        %{blocker_type: :moderation_suspend, cause_code: "review_pending"},
        operation_ref: Ecto.UUID.generate()
      )

    assert {:error, %{reason: :ancestor_community_not_writable}} =
             CMS.Comments.accept_solution(first.id, actor)

    refute Repo.get_by(PostSolution, comment_id: first.id)
  end

  test "deleting the current solution atomically revokes it", context do
    ~m(post actor first)a = context
    {:ok, _} = CMS.Comments.accept_solution(first.id, actor)

    assert {:ok, deleted} = CMS.Comments.delete_comment(first, actor)
    assert deleted.body_html == Comment.delete_hint()
    refute Repo.get_by(PostSolution, post_id: post.id)
    assert Repo.get_by!(CommentLifecycle, comment_id: first.id).state == :deleted
    assert Repo.get_by!(PostLog, post_ref: post.article_hash_id, action: :solution_revoked)
  end

  test "deleting another comment keeps the current solution", context do
    ~m(post actor first second)a = context
    {:ok, _} = CMS.Comments.accept_solution(first.id, actor)

    assert {:ok, _} = CMS.Comments.delete_comment(second, actor)
    assert Repo.get_by!(PostSolution, post_id: post.id).comment_id == first.id
  end

  test "deleted and destroyed targets are rejected before relation writes", context do
    ~m(post actor first second)a = context
    {:ok, _} = CMS.Comments.delete_comment(first, actor)

    assert {:error, %{reason: :comment_deleted}} =
             CMS.Comments.accept_solution(first.id, actor)

    {:ok, _} = Lifecycle.transition(second.id, :destroy)

    assert {:error, %{reason: :comment_destroyed}} =
             CMS.Comments.accept_solution(second.id, actor)

    refute Repo.get_by(PostSolution, post_id: post.id)
  end

  test "read projections derive comment and post fields from the relation", context do
    ~m(post actor first)a = context
    {:ok, _} = CMS.Comments.accept_solution(first.id, actor)

    assert {:ok, %{is_solution: true}} = CMS.Comments.one_comment(first.id)

    {:ok, post} = CMS.Articles.InteractionResponse.one(Repo.get!(Post, post.id), nil)
    assert post.is_solved
    assert post.solution_comment_id == first.inner_id
    assert post.solution_digest == "first"

    {:ok, _} = CMS.Comments.update_comment(first, mock_comment("changed"), actor)
    {:ok, post} = CMS.Articles.InteractionResponse.one(Repo.get!(Post, post.id), nil)
    assert post.solution_digest == "changed"
  end

  test "comment list puts the solution first without manufacturing a pin", context do
    ~m(post actor first second)a = context
    {:ok, _} = CMS.Comments.pin_comment(first.id, actor)
    {:ok, _} = CMS.Comments.accept_solution(second.id, actor)

    assert {:ok, page} =
             CMS.Comments.paged_comments(
               :post,
               post.id,
               %{page: 1, size: 20, sort: :asc_inserted},
               :replies
             )

    assert [%{id: solution_id, is_solution: true} | _] = page.entries
    assert solution_id == second.id
    refute Repo.get_by(PinnedComment, comment_id: second.id)
    assert Enum.any?(page.entries, &(&1.id == first.id and &1.is_pinned))
  end

  test "concurrent accepts serialize to one authoritative relation", context do
    ~m(post actor first second)a = context

    results =
      [first, second]
      |> Enum.map(fn comment ->
        Task.async(fn -> CMS.Comments.accept_solution(comment.id, actor) end)
      end)
      |> Task.await_many(10_000)

    assert Enum.all?(results, &match?({:ok, _}, &1))

    assert Repo.aggregate(
             from(solution in PostSolution, where: solution.post_id == ^post.id),
             :count
           ) ==
             1

    current = Repo.get_by!(PostSolution, post_id: post.id)
    assert current.comment_id in [first.id, second.id]
  end

  test "delete and accept serialize without leaving a solution on a tombstone", context do
    ~m(post actor first)a = context

    [accept_result, delete_result] =
      [
        Task.async(fn -> CMS.Comments.accept_solution(first.id, actor) end),
        Task.async(fn -> CMS.Comments.delete_comment(first, actor) end)
      ]
      |> Task.await_many(10_000)

    assert match?({:ok, _}, delete_result)

    assert match?({:ok, _}, accept_result) or
             match?({:error, %{reason: :comment_deleted}}, accept_result)

    refute Repo.get_by(PostSolution, post_id: post.id)
    assert Repo.get_by!(CommentLifecycle, comment_id: first.id).state == :deleted
  end

  test "comment update and solution replacement serialize on the Post aggregate", context do
    ~m(post actor first second)a = context
    {:ok, _} = CMS.Comments.accept_solution(first.id, actor)

    [update_result, replace_result] =
      [
        Task.async(fn -> CMS.Comments.update_comment(first, mock_comment("updated"), actor) end),
        Task.async(fn -> CMS.Comments.accept_solution(second.id, actor) end)
      ]
      |> Task.await_many(10_000)

    assert match?({:ok, _}, update_result)
    assert match?({:ok, _}, replace_result)
    assert Repo.get_by!(PostSolution, post_id: post.id).comment_id == second.id

    {:ok, projected_post} = CMS.Articles.InteractionResponse.one(Repo.get!(Post, post.id), nil)
    assert projected_post.solution_comment_id == second.inner_id
    assert projected_post.solution_digest == "second"
  end

  test "Comment and Post solution projections use one relation query per batch", context do
    ~m(post actor first second)a = context
    {:ok, _} = CMS.Comments.accept_solution(first.id, actor)

    {{:ok, comments}, comment_queries} =
      capture_queries(fn ->
        CMS.Comments.InteractionResponse.many([first, second], nil)
      end)

    assert Enum.count(comments, & &1.is_solution) == 1
    assert solution_query_count(comment_queries) == 1

    {{:ok, [projected_post]}, article_queries} =
      capture_queries(fn ->
        CMS.Articles.InteractionResponse.many([Repo.get!(Post, post.id)], nil)
      end)

    assert projected_post.is_solved
    assert solution_query_count(article_queries) == 1
  end

  test "database rejects a Post and Comment ownership mismatch", context do
    ~m(community actor first)a = context
    other_attrs = mock_attrs(:post, %{community_id: community.id, cat: @article_cat.qa})
    {:ok, other_post} = CMS.Articles.create(community, :post, other_attrs, actor)

    changeset =
      PostSolution.changeset(%PostSolution{}, %{
        post_id: other_post.id,
        comment_id: first.id,
        accepted_by_id: actor.id,
        accepted_at: DateTime.utc_now(:second)
      })

    assert {:error, changeset} = Repo.insert(changeset)
    assert {"must belong to the selected post", _meta} = changeset.errors[:comment_id]
  end

  test "physical hard delete cascades the authoritative relation", context do
    ~m(post actor first)a = context
    {:ok, _} = CMS.Comments.accept_solution(first.id, actor)

    assert {:ok, _} = Repo.delete(Repo.get!(Comment, first.id))
    refute Repo.get_by(PostSolution, post_id: post.id)
  end

  defp capture_queries(fun) do
    ref = make_ref()
    handler_id = {__MODULE__, ref}
    owner = self()
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

    :ok =
      :telemetry.attach(
        handler_id,
        event,
        fn _event, _measurements, metadata, {pid, query_ref, owner_pid} ->
          if self() == owner_pid, do: send(pid, {query_ref, metadata.query})
        end,
        {self(), ref, owner}
      )

    try do
      result = fun.()
      {result, drain_queries(ref, [])}
    after
      :telemetry.detach(handler_id)
    end
  end

  defp drain_queries(ref, queries) do
    receive do
      {^ref, query} -> drain_queries(ref, [query | queries])
    after
      0 -> Enum.reverse(queries)
    end
  end

  defp solution_query_count(queries) do
    Enum.count(queries, fn query ->
      query
      |> String.downcase()
      |> String.contains?("post_solutions")
    end)
  end
end
