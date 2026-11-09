defmodule GroupherServer.Test.CMS.Comments.ConcurrencyTest do
  use ExUnit.Case, async: false
  import Ecto.Query
  import GroupherServer.Support.Factory
  alias Ecto.Adapters.SQL.Sandbox
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleStats, Comment, PostReactionInfo}

  @tag timeout: 90_000
  test "CNT-01 ACT-03 independent connections preserve counts, distinct authors and numbering" do
    Sandbox.unboxed_run(Repo, fn ->
      {community, article, _, _} = mock_article(:post)

      users =
        for _ <- 1..4 do
          {:ok, user} = db_insert(:user)
          user
        end

      try do
        comments =
          simultaneous(users, fn actor ->
            CMS.Comments.create_comment(
              community,
              :post,
              article.inner_id,
              mock_comment(),
              actor,
              Ecto.UUID.generate()
            )
          end)

        stats = Repo.get_by!(ArticleStats, article_id: article.article_id)
        assert stats.comments_count == 4
        assert stats.comments_participants_count == 4
        assert stats.comments_revision == 5
        assert comments |> Enum.map(& &1.inner_id) |> Enum.uniq() |> length() == 4
        assert comments |> Enum.map(& &1.floor) |> Enum.uniq() |> length() == 4
        root = %{hd(comments) | request_community_slug: community.slug}

        simultaneous(users, fn actor ->
          CMS.Comments.reply_comment(root, mock_comment(), actor, Ecto.UUID.generate())
        end)

        root = Repo.get!(Comment, root.id)
        stats = Repo.get_by!(ArticleStats, article_id: article.article_id)
        assert root.replies_count == 4
        assert root.reply_entries_count == 4
        assert root.replies_revision == 5
        assert length(root.reply_participants) == 4
        assert stats.comments_count == 8
        assert stats.comments_participants_count == 4
        assert stats.comments_revision == 9

        simultaneous(users, fn actor ->
          CMS.Interactions.upvote(article, actor, Ecto.UUID.generate())
        end)

        assert reaction_info(article.article_id).upvotes_count == 4

        simultaneous(users, fn actor ->
          CMS.Interactions.undo_upvote(article, actor, Ecto.UUID.generate())
        end)

        projection = reaction_info(article.article_id)
        assert projection.upvotes_count == 0
        assert projection.latest_upvoted_users == []
        assert Repo.get_by!(ArticleStats, article_id: article.article_id).comments_revision == 9
      after
        Repo.delete!(Repo.get!(Article, article.article_id))
      end
    end)
  end

  defp reaction_info(article_id) do
    Repo.one!(
      from(info in PostReactionInfo,
        where: info.article_id == ^article_id,
        select: %{
          upvotes_count: info.upvotes_count,
          latest_upvoted_users: info.latest_upvoted_users
        }
      )
    )
  end

  defp simultaneous(users, operation) do
    parent = self()

    tasks =
      Enum.map(users, fn user ->
        Task.async(fn ->
          Sandbox.unboxed_run(Repo, fn ->
            send(parent, {:ready, self()})

            receive do
              :go -> operation.(user)
            after
              10_000 -> {:error, :barrier_timeout}
            end
          end)
        end)
      end)

    for _ <- tasks, do: assert_receive({:ready, _pid}, 10_000)
    Enum.each(tasks, &send(&1.pid, :go))

    Enum.map(tasks, fn task ->
      assert {:ok, value} = Task.await(task, 30_000)
      value
    end)
  end
end
