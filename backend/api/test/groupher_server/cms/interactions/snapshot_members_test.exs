defmodule GroupherServer.Test.CMS.Interactions.SnapshotMembersTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    ArticleUpvote,
    PostReactionInfo,
    PostEmotionInfo,
    CommentReactionInfo,
    CommentEmotionInfo
  }

  test "RX-02 RX-04 upvote, emotion and collect replenish the fifth effective participant" do
    {_community, article, _, _} = mock_article(:post)

    users =
      for _ <- 1..7 do
        {:ok, user} = db_insert(:user)
        user
      end

    for user <- users do
      assert {:ok, _} = CMS.Interactions.upvote(article, user, Ecto.UUID.generate())
      assert {:ok, _} = CMS.Interactions.emotion(article, :beer, user, Ecto.UUID.generate())
      assert {:ok, _} = CMS.Interactions.collect(article, user, Ecto.UUID.generate())
    end

    outside = hd(users)
    assert {:ok, _} = CMS.Interactions.undo_upvote(article, outside, Ecto.UUID.generate())
    assert {:ok, _} = CMS.Interactions.undo_emotion(article, :beer, outside, Ecto.UUID.generate())
    assert {:ok, _} = CMS.Interactions.undo_collect(article, outside, Ecto.UUID.generate())
    newest = List.last(users)
    assert {:ok, _} = CMS.Interactions.upvote(article, newest, Ecto.UUID.generate())
    assert {:ok, _} = CMS.Interactions.undo_upvote(article, newest, Ecto.UUID.generate())
    assert {:ok, _} = CMS.Interactions.undo_emotion(article, :beer, newest, Ecto.UUID.generate())
    assert {:ok, _} = CMS.Interactions.undo_collect(article, newest, Ecto.UUID.generate())
    expected = users |> Enum.drop(1) |> Enum.drop(-1) |> Enum.reverse() |> Enum.map(& &1.id)

    fixed =
      Repo.one!(
        from(i in PostReactionInfo,
          where: i.article_id == ^article.article_id,
          select: %{
            count: i.upvotes_count,
            collects: i.collects_count,
            users: i.latest_upvoted_users,
            collected: i.latest_collected_users
          }
        )
      )

    assert fixed.count == 5
    assert fixed.collects == 5
    assert ids(fixed.users) == expected
    assert ids(fixed.collected) == expected

    emotion =
      Repo.one!(
        from(i in PostEmotionInfo,
          where: i.article_id == ^article.article_id and i.emotion == "beer",
          select: %{count: i.users_count, users: i.latest_users}
        )
      )

    assert emotion.count == 5
    assert ids(emotion.users) == expected
  end

  test "RX-02 Comment reactions use the same bounded replenishment" do
    {community, article, _, author} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article.inner_id,
        mock_comment(),
        author,
        Ecto.UUID.generate()
      )

    users =
      for _ <- 1..7 do
        {:ok, user} = db_insert(:user)
        assert {:ok, _} = CMS.Interactions.upvote(comment, user, Ecto.UUID.generate())
        assert {:ok, _} = CMS.Interactions.emotion(comment, :heart, user, Ecto.UUID.generate())
        user
      end

    outside = hd(users)
    assert {:ok, _} = CMS.Interactions.undo_upvote(comment, outside, Ecto.UUID.generate())

    assert {:ok, _} =
             CMS.Interactions.undo_emotion(comment, :heart, outside, Ecto.UUID.generate())

    newest = List.last(users)
    assert {:ok, _} = CMS.Interactions.undo_upvote(comment, newest, Ecto.UUID.generate())
    assert {:ok, _} = CMS.Interactions.undo_emotion(comment, :heart, newest, Ecto.UUID.generate())
    expected = users |> Enum.drop(1) |> Enum.drop(-1) |> Enum.reverse() |> Enum.map(& &1.id)

    fixed =
      Repo.one!(
        from(i in CommentReactionInfo,
          where: i.comment_id == ^comment.id,
          select: %{count: i.upvotes_count, users: i.latest_upvoted_users}
        )
      )

    emotion =
      Repo.one!(
        from(i in CommentEmotionInfo,
          where: i.comment_id == ^comment.id and i.emotion == "heart",
          select: %{count: i.users_count, users: i.latest_users}
        )
      )

    assert fixed.count == 5
    assert emotion.count == 5
    assert ids(fixed.users) == expected
    assert ids(emotion.users) == expected
  end

  test "CNT-04 corrupted counters cannot silently underflow or lose the authoritative fact" do
    {_community, article, _, actor} = mock_article(:post)
    {:ok, _} = CMS.Interactions.upvote(article, actor, Ecto.UUID.generate())

    Repo.update_all(from(i in PostReactionInfo, where: i.article_id == ^article.article_id),
      set: [upvotes_count: 0]
    )

    assert {:error, _} = CMS.Interactions.undo_upvote(article, actor, Ecto.UUID.generate())

    assert Repo.exists?(
             from(f in ArticleUpvote,
               where: f.article_id == ^article.article_id and f.user_id == ^actor.id
             )
           )
  end

  defp ids(users), do: Enum.map(users, &(Map.get(&1, "id") || Map.get(&1, :id)))
end
