defmodule GroupherServer.Test.CMS.Comments.SummaryTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{ArticleStats, Comment, CommentLifecycle}

  setup do
    {community, article, _, author} = mock_article(:post)
    {:ok, second} = db_insert(:user)
    {:ok, %{community: community, article: article, author: author, second: second}}
  end

  test "first publication creates an empty persisted comment summary", ctx do
    stats = stats(ctx.article)
    assert stats.comments_count == 0
    assert stats.comments_participants_count == 0
    assert stats.comments_participants == []
    assert stats.comments_revision == 1
  end

  test "changed facts count once, snapshots use stable users and command replay is unchanged",
       ctx do
    id = Ecto.UUID.generate()
    {:ok, first} = create(ctx, ctx.author, id)
    {:ok, replay} = create(ctx, ctx.author, id)
    assert replay.id == first.id
    assert stats(ctx.article).comments_count == 1
    assert stats(ctx.article).comments_revision == 2
    {:ok, _} = create(ctx, ctx.author)
    {:ok, _} = create(ctx, ctx.second)
    stats = stats(ctx.article)
    assert stats.comments_count == 3
    assert stats.comments_participants_count == 2
    assert Enum.map(stats.comments_participants, & &1.id) == [ctx.second.id, ctx.author.id]
  end

  test "nested replies maintain the canonical root, deleted placeholders remain entries", ctx do
    {:ok, root} = create(ctx, ctx.author)

    {:ok, reply} =
      CMS.Comments.reply_comment(root, mock_comment(), ctx.second, Ecto.UUID.generate())

    {:ok, nested} =
      CMS.Comments.reply_comment(reply, mock_comment(), ctx.author, Ecto.UUID.generate())

    root = Repo.get!(Comment, root.id)
    assert root.replies_count == 2
    assert root.reply_entries_count == 2
    assert Enum.map(root.reply_participants, & &1.id) == [ctx.author.id, ctx.second.id]
    assert root.last_reply_at == nested.inserted_at
    assert stats(ctx.article).comments_count == 3
    {:ok, _} = CMS.Comments.delete_comment(nested, ctx.author, Ecto.UUID.generate())
    root = Repo.get!(Comment, root.id)
    assert root.replies_count == 1
    assert root.reply_entries_count == 2
    assert root.last_reply_at == reply.inserted_at
    {:ok, _} = CMS.Comments.delete_comment(reply, ctx.second, Ecto.UUID.generate())
    root = Repo.get!(Comment, root.id)
    assert root.replies_count == 0
    assert root.reply_entries_count == 2
    assert root.reply_participants == []
    assert root.last_reply_at == nil
  end

  test "multiple review blocks change counts only across effective visibility", ctx do
    {:ok, comment} = create(ctx, ctx.second)
    lifecycle = Repo.get_by!(CommentLifecycle, comment_id: comment.id)
    first = apply_block(lifecycle, "first")
    second = apply_block(lifecycle, "second")
    assert stats(ctx.article).comments_count == 0
    assert stats(ctx.article).comments_participants_count == 0
    assert stats(ctx.article).comments_participants == []
    end_block(lifecycle, first.id)
    assert stats(ctx.article).comments_count == 0
    end_block(lifecycle, second.id)
    assert stats(ctx.article).comments_count == 1
    assert stats(ctx.article).comments_participants_count == 1
    assert Enum.map(stats(ctx.article).comments_participants, & &1.id) == [ctx.second.id]
  end

  test "failed enclosing transaction rolls back fact, counts and snapshots", ctx do
    before = stats(ctx.article)

    assert {:error, :abort} =
             Repo.transaction(fn ->
               {:ok, _} = create(ctx, ctx.author)
               Repo.rollback(:abort)
             end)

    after_abort = stats(ctx.article)
    assert after_abort.comments_count == before.comments_count
    assert after_abort.comments_revision == before.comments_revision
    assert after_abort.comments_participants == before.comments_participants
    refute Repo.exists?(from(c in Comment, where: c.article_id == ^before.article_id))
  end

  test "SNAP-01 bounded root members deduplicate users and replenish the fifth author", ctx do
    {:ok, root} = create(ctx, ctx.author)

    replies =
      for _ <- 1..6 do
        {:ok, user} = db_insert(:user)

        {:ok, reply} =
          CMS.Comments.reply_comment(root, mock_comment(), user, Ecto.UUID.generate())

        {reply, user}
      end

    root = Repo.get!(Comment, root.id)
    assert root.replies_count == 6
    assert length(root.reply_participants) == 4

    assert Enum.map(root.reply_participants, & &1.id) ==
             replies |> Enum.reverse() |> Enum.take(4) |> Enum.map(fn {_, user} -> user.id end)

    {newest, actor} = List.last(replies)
    {:ok, _} = CMS.Comments.delete_comment(newest, actor, Ecto.UUID.generate())
    root = Repo.get!(Comment, root.id)
    assert root.replies_count == 5
    assert root.reply_entries_count == 6

    assert Enum.map(root.reply_participants, & &1.id) ==
             replies
             |> Enum.drop(-1)
             |> Enum.reverse()
             |> Enum.take(4)
             |> Enum.map(fn {_, user} -> user.id end)
  end

  test "FOLD-01 changed and unchanged fold preserve facts and advance only their owner versions",
       ctx do
    {:ok, root} = create(ctx, ctx.author)

    {:ok, reply} =
      CMS.Comments.reply_comment(root, mock_comment(), ctx.second, Ecto.UUID.generate())

    before_root = Repo.get!(Comment, root.id)
    before_stats = stats(ctx.article)
    {:ok, folded} = CMS.Comments.fold_comment(reply, ctx.second)
    after_root = Repo.get!(Comment, root.id)
    assert after_root.replies_count == before_root.replies_count
    assert after_root.reply_participants == before_root.reply_participants
    assert after_root.last_reply_at == before_root.last_reply_at
    assert after_root.replies_revision == before_root.replies_revision + 1
    assert stats(ctx.article).comments_revision == before_stats.comments_revision + 1
    {:ok, _} = CMS.Comments.fold_comment(folded, ctx.second)
    assert Repo.get!(Comment, root.id).replies_revision == after_root.replies_revision
    assert stats(ctx.article).comments_revision == before_stats.comments_revision + 1
  end

  test "CNT-03 deleting or hiding the root does not erase descendant contributions", ctx do
    {:ok, root} = create(ctx, ctx.author)

    {:ok, _reply} =
      CMS.Comments.reply_comment(root, mock_comment(), ctx.second, Ecto.UUID.generate())

    before = Repo.get!(Comment, root.id)
    {:ok, _} = CMS.Comments.delete_comment(root, ctx.author, Ecto.UUID.generate())
    assert stats(ctx.article).comments_count == 1
    assert stats(ctx.article).comments_participants_count == 1
    assert Repo.get!(Comment, root.id).replies_count == before.replies_count
    assert Repo.get!(Comment, root.id).reply_participants == before.reply_participants

    {:ok, page} =
      CMS.Comments.reply_page(root, ctx.community.slug, %{}, %{
        offset: %{page: 1, size: 20, config_revision: 0}
      })

    assert length(page.entries) == 1
  end

  test "SNAP-01 article snapshots cap twelve distinct authors at ten and replenish by facts",
       ctx do
    actors = [
      ctx.author
      | Enum.map(1..11, fn _ ->
          {:ok, user} = db_insert(:user)
          user
        end)
    ]

    comments =
      Enum.map(actors, fn actor ->
        {:ok, comment} = create(ctx, actor)
        comment
      end)

    summary = stats(ctx.article)
    assert summary.comments_count == 12
    assert summary.comments_participants_count == 12

    assert Enum.map(summary.comments_participants, & &1.id) ==
             actors |> Enum.reverse() |> Enum.take(10) |> Enum.map(& &1.id)

    {:ok, _} =
      CMS.Comments.delete_comment(List.last(comments), List.last(actors), Ecto.UUID.generate())

    assert stats(ctx.article).comments_count == 11

    assert Enum.map(stats(ctx.article).comments_participants, & &1.id) ==
             actors |> Enum.drop(-1) |> Enum.reverse() |> Enum.take(10) |> Enum.map(& &1.id)
  end

  test "CNT-04 a corrupted Comment counter rolls the tombstone and facts back", ctx do
    {:ok, comment} = create(ctx, ctx.author)

    Repo.update_all(from(s in ArticleStats, where: s.article_id == ^ctx.article.article_id),
      set: [comments_count: 0]
    )

    assert {:error, _} = CMS.Comments.delete_comment(comment, ctx.author, Ecto.UUID.generate())
    assert Repo.get_by!(CommentLifecycle, comment_id: comment.id).state == :visible

    assert Repo.preload(Repo.get!(Comment, comment.id), :body).body.version ==
             Repo.preload(comment, :body).body.version
  end

  test "READ-01 summary SQL budget is independent of Comment history", ctx do
    ref = make_ref()
    caller = self()
    handler = {__MODULE__, ref}
    event = Repo.config()[:telemetry_prefix] ++ [:query]

    :ok =
      :telemetry.attach(
        handler,
        event,
        fn _, _, meta, _ ->
          if self() == caller, do: send(caller, {:summary_sql, ref, meta.query})
        end,
        nil
      )

    drain = fn drain, acc ->
      receive do
        {:summary_sql, ^ref, query} -> drain.(drain, [query | acc])
      after
        0 -> Enum.reverse(acc)
      end
    end

    read = fn ->
      drain.(drain, [])

      assert {:ok, _} =
               CMS.Comments.comments_state(:post, ctx.article.article_id, nil, ctx.community.slug)

      drain.(drain, [])
    end

    try do
      empty = read.()
      Enum.each(1..8, fn _ -> assert {:ok, _} = create(ctx, ctx.author) end)
      populated = read.()
      assert length(populated) == length(empty)

      for sql <- empty ++ populated do
        refute sql =~ ~s("cms"."comments")
        refute String.downcase(sql) =~ "count("
      end
    after
      :telemetry.detach(handler)
    end
  end

  test "READ-02 public GraphQL exposes stable member refs and persisted reply summaries", ctx do
    {:ok, root} = create(ctx, ctx.author)

    assert {:ok, _} =
             CMS.Comments.reply_comment(root, mock_comment(), ctx.second, Ecto.UUID.generate())

    document = """
    query($article: ArticlePathInput!) {
      commentsState(article: $article) { totalCount participantsCount participants { ref login avatar } }
    }
    """

    assert {:ok, %{data: %{"commentsState" => state}} = result} =
             Absinthe.run(
               document,
               GroupherServerWeb.Schema,
               variables: %{
                 "article" => %{
                   "community" => ctx.community.slug,
                   "thread" => "POST",
                   "innerId" => to_string(ctx.article.inner_id)
                 }
               }
             )

    refute Map.has_key?(result, :errors)
    assert state["totalCount"] == 2
    assert state["participantsCount"] == 2
    assert length(state["participants"]) == 2
    refs = Enum.map(state["participants"], & &1["ref"])
    assert Enum.all?(refs, &(is_binary(&1) and byte_size(&1) == 43))
    assert length(Enum.uniq(refs)) == 2
    refute to_string(ctx.author.id) in refs
  end

  test "REL-01 missing summary rows fail closed without lazy initialization", ctx do
    Repo.delete!(stats(ctx.article))
    assert {:error, _} = CMS.ArticleStats.fetch(:post, ctx.article.article_id)

    assert {:error, _} =
             CMS.Comments.comments_state(:post, ctx.article.article_id, nil, ctx.community.slug)

    assert {:error, _} = create(ctx, ctx.author)
    refute Repo.exists?(from(c in Comment, where: c.article_id == ^ctx.article.article_id))
    refute Repo.exists?(from(s in ArticleStats, where: s.article_id == ^ctx.article.article_id))
  end

  defp create(ctx, actor, id \\ Ecto.UUID.generate()) do
    CMS.Comments.create_comment(
      ctx.community,
      :post,
      article_inner_id(ctx.article, ctx.community),
      mock_comment(),
      actor,
      id
    )
  end

  defp stats(article) do
    id = Map.get(article, :article_id) || article.id
    Repo.get_by!(ArticleStats, article_id: id)
  end

  defp apply_block(lifecycle, source) do
    {:ok, {:ok, block}} =
      Repo.transaction(fn ->
        CMS.ReviewBlocks.apply(lifecycle, %{
          scope_key: "platform",
          type: :human_review_hold,
          source: :request,
          source_ref: source,
          applied_at: DateTime.utc_now(:second)
        })
      end)

    block
  end

  defp end_block(lifecycle, id) do
    {:ok, {:ok, :pass}} =
      Repo.transaction(fn ->
        CMS.ReviewBlocks.end_blocks(lifecycle, "platform", [id], Ecto.UUID.generate(), "test")
      end)
  end
end
