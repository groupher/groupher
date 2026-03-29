defmodule GroupherServer.Test.Query.Comments.PostComment do
  @moduledoc false

  use GroupherServer.TestMate

  defp emotion_entry(emotions, type) do
    Enum.find(emotions || [], &(&1["type"] == String.upcase(to_string(type))))
  end

  setup do
    {community, post, _, user} = mock_article(:post, preload: [author: :user])

    {:ok, user2} = db_insert(:user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community post user user2)a}
  end

  @query """
  query($article: ArticleRefInput!) {
    commentsState(article: $article) {
      totalCount
      isViewerJoined
      participantsCount

      participants {
        login
        nickname
        avatar
      }
    }
  }
  """

  test "can get basic comments state", ~m(guest_conn user_conn community post user)a do
    {:ok, _} =
      CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

    variables = %{
      article: %{inner_id: post.inner_id, community: post.community_slug, thread: "POST"}
    }

    results = guest_conn |> gq_query(@query, variables)

    assert results["participantsCount"] == 1
    assert results["totalCount"] == 1
    assert not results["isViewerJoined"]
    assert user_exist_in?(user, results["participants"])

    results = user_conn |> gq_query(@query, variables)
    assert results["isViewerJoined"]
  end

  @query """
  query($id: ID!) {
    oneComment(id: $id) {
      id
      body
      isArchived
      archivedAt
      viewerHasUpvoted
      emotions {
        type
        count
        viewerHasReacted
      }
    }
  }
  """

  test "can get one comment by id", ~m(guest_conn community post user)a do
    thread = :post

    {:ok, comment} =
      CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

    variables = %{id: comment.id}
    results = guest_conn |> gq_query(@query, variables)

    assert results["id"] == to_string(comment.id)
  end

  test "can get one comment by id with viewer states", ~m(user_conn community post user)a do
    thread = :post

    {:ok, comment} =
      CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

    {:ok, _} = CMS.Comments.upvote_comment(comment.id, user)
    {:ok, _} = CMS.Comments.emotion_to_comment(comment.id, :downvote, user)

    variables = %{id: comment.id}
    results = user_conn |> gq_query(@query, variables)

    assert results["id"] == to_string(comment.id)
    assert results["viewerHasUpvoted"]
    assert emotion_entry(results["emotions"], :downvote)["viewerHasReacted"]
  end

  describe "[basic article post comment]" do
    test "guest user can get basic archive info", ~m(guest_conn community post user)a do
      thread = :post

      {:ok, _} =
        CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

      variables = %{article: %{inner_id: post.inner_id, community: post.community_slug}}
      results = guest_conn |> gq_query(Schema.q(:article, :post), variables)

      assert not results["isArchived"]
    end

    test "guest user can get comment participants after comment created",
         ~m(guest_conn community post user user2)a do
      total_count = 5
      thread = :post

      Enum.reduce(1..total_count, [], fn _, acc ->
        {:ok, comment} =
          CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

        acc ++ [comment]
      end)

      {:ok, _} =
        CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user2)

      variables = %{article: %{inner_id: post.inner_id, community: post.community_slug}}
      results = guest_conn |> gq_query(Schema.q(:article, :post), variables)

      comments_participants = results["commentsParticipants"]
      comments_participants_count = results["commentsParticipantsCount"]

      assert is_list(comments_participants)
      assert length(comments_participants) == 2
      assert comments_participants_count == 2
    end

    @query """
      query($article: ArticleRefInput!, $mode: CommentsMode, $filter: CommentsFilter!) {
        pagedComments(article: $article, mode: $mode, filter: $filter) {
          entries {
            id
            bodyHtml
            author {
              id
              nickname
            }
            isPinned
            floor
            upvotesCount

            emotions {
              type
              count
              latestUsers {
                login
                nickname
              }
              viewerHasReacted
            }
            isArticleAuthor
            meta {
              isArticleAuthorUpvoted
              isLegal
              illegalReason
              illegalWords
            }
            replyTo {
              id
              bodyHtml
              floor
              isArticleAuthor
              author {
                id
                login
              }
            }
            viewerHasUpvoted
            replies {
              id
              bodyHtml
              replyTo {
                id
                author {
                  login
                  nickname
                }
              }
              repliesCount
              author {
                id
                login
              }
            }
            repliesCount
          }
          totalPages
          totalCount
          pageSize
          pageNumber
        }
    }
    """
    test "list comments with default replies-mode", ~m(guest_conn community post user user2)a do
      total_count = 3
      page_size = 20
      thread = :post

      all_comments =
        Enum.reduce(1..total_count, [], fn i, acc ->
          {:ok, comment} =
            CMS.Comments.create_comment(
              community,
              thread,
              post.inner_id,
              mock_comment("comment #{i}"),
              user
            )

          acc ++ [comment]
        end)

      random_comment = all_comments |> Enum.at(Enum.random(0..(total_count - 1)))

      assert random_comment.meta.is_legal

      {:ok, replied_comment_1} =
        CMS.Comments.reply_comment(random_comment.id, mock_comment(), user2)

      {:ok, replied_comment_2} =
        CMS.Comments.reply_comment(random_comment.id, mock_comment(), user2)

      variables = %{
        article: %{inner_id: post.inner_id, community: post.community_slug, thread: "POST"},
        filter: %{page: 1, size: page_size}
      }

      results = guest_conn |> gq_query(@query, variables)
      assert results["entries"] |> length == total_count

      assert not exist_in?(replied_comment_1, results["entries"])
      assert not exist_in?(replied_comment_2, results["entries"])

      random_comment = Enum.find(results["entries"], &(&1["id"] == to_string(random_comment.id)))

      assert random_comment["replies"] |> length == 2
      assert random_comment["repliesCount"] == 2

      assert random_comment["replies"] |> List.first() |> Map.get("id") ==
               to_string(replied_comment_1.id)

      assert not is_nil(random_comment["replies"] |> List.first() |> Map.get("replyTo"))

      assert random_comment["replies"] |> List.last() |> Map.get("id") ==
               to_string(replied_comment_2.id)
    end

    test "timeline-mode paged comments", ~m(guest_conn community post user user2)a do
      total_count = 3
      page_size = 20
      thread = :post

      all_comments =
        Enum.reduce(1..total_count, [], fn i, acc ->
          {:ok, comment} =
            CMS.Comments.create_comment(
              community,
              thread,
              post.inner_id,
              mock_comment("comment #{i}"),
              user
            )

          acc ++ [comment]
        end)

      random_comment = all_comments |> Enum.at(Enum.random(0..(total_count - 1)))

      {:ok, replied_comment_1} =
        CMS.Comments.reply_comment(random_comment.id, mock_comment(), user2)

      {:ok, replied_comment_2} =
        CMS.Comments.reply_comment(random_comment.id, mock_comment(), user2)

      variables = %{
        article: %{inner_id: post.inner_id, community: post.community_slug, thread: "POST"},
        mode: "TIMELINE",
        filter: %{page: 1, size: page_size}
      }

      results = guest_conn |> gq_query(@query, variables)
      assert results["entries"] |> length == total_count + 2

      assert exist_in?(replied_comment_1, results["entries"])
      assert exist_in?(replied_comment_2, results["entries"])

      random_comment = Enum.find(results["entries"], &(&1["id"] == to_string(random_comment.id)))
      assert random_comment["replies"] |> length == 2
      assert random_comment["repliesCount"] == 2
    end

    test "comment should have reply_to content if need",
         ~m(guest_conn community post user user2)a do
      total_count = 2
      thread = :post

      Enum.reduce(0..total_count, [], fn i, acc ->
        {:ok, comment} =
          CMS.Comments.create_comment(
            community,
            thread,
            post.inner_id,
            mock_comment("comment #{i}"),
            user
          )

        acc ++ [comment]
      end)

      {:ok, parent_comment} =
        CMS.Comments.create_comment(
          community,
          :post,
          post.inner_id,
          mock_comment("parent_comment"),
          user
        )

      {:ok, replied_comment_1} =
        CMS.Comments.reply_comment(parent_comment.id, mock_comment(), user2)

      {:ok, replied_comment_2} =
        CMS.Comments.reply_comment(parent_comment.id, mock_comment(), user2)

      variables = %{
        article: %{inner_id: post.inner_id, community: post.community_slug, thread: "POST"},
        filter: %{page: 1, size: 10},
        mode: "TIMELINE"
      }

      results = guest_conn |> gq_query(@query, variables)

      replied_comment_1 =
        Enum.find(results["entries"], &(&1["id"] == to_string(replied_comment_1.id)))

      assert replied_comment_1 |> get_in(["replyTo", "id"]) == to_string(parent_comment.id)

      assert replied_comment_1 |> get_in(["replyTo", "author", "id"]) ==
               to_string(parent_comment.author_id)

      replied_comment_2 =
        Enum.find(results["entries"], &(&1["id"] == to_string(replied_comment_2.id)))

      assert replied_comment_2 |> get_in(["replyTo", "id"]) == to_string(parent_comment.id)

      assert replied_comment_2 |> get_in(["replyTo", "author", "id"]) ==
               to_string(parent_comment.author_id)
    end

    test "guest user can get paged comment for post", ~m(guest_conn community post user)a do
      total_count = 30
      thread = :post

      Enum.reduce(1..total_count, [], fn _, acc ->
        {:ok, value} =
          CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

        acc ++ [value]
      end)

      variables = %{
        article: %{inner_id: post.inner_id, community: post.community_slug, thread: "POST"},
        filter: %{page: 1, size: 10}
      }

      results = guest_conn |> gq_query(@query, variables)

      assert results |> is_valid_pagination?
      assert results["totalCount"] == total_count
    end

    test "guest user can get paged comment with pinned comment in it",
         ~m(guest_conn community post user)a do
      total_count = 20
      thread = :post

      Enum.reduce(1..total_count, [], fn _, acc ->
        {:ok, comment} =
          CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

        acc ++ [comment]
      end)

      {:ok, comment} =
        CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

      {:ok, pinned_comment} = CMS.Comments.pin_comment(comment.id)

      Process.sleep(1000)

      {:ok, comment} =
        CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

      {:ok, pinned_comment2} = CMS.Comments.pin_comment(comment.id)

      variables = %{
        article: %{inner_id: post.inner_id, community: post.community_slug, thread: "POST"},
        filter: %{page: 1, size: 10}
      }

      results = guest_conn |> gq_query(@query, variables)

      assert results["entries"] |> List.first() |> Map.get("id") == to_string(pinned_comment2.id)
      assert results["entries"] |> Enum.at(1) |> Map.get("id") == to_string(pinned_comment.id)

      assert results["totalCount"] == total_count + 2
    end

    test "if solution in pinned comments, solution should always on top",
         ~m(guest_conn community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id, is_question: true})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      total_count = 20
      thread = :post

      Enum.reduce(1..total_count, [], fn _, acc ->
        {:ok, comment} =
          CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

        acc ++ [comment]
      end)

      {:ok, post} = ORM.find(Post, post.id, preload: [author: :user])
      post_author = post.author.user

      {:ok, comment} =
        CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

      {:ok, _pinned_comment} = CMS.Comments.pin_comment(comment.id)

      Process.sleep(1000)

      {:ok, comment} =
        CMS.Comments.create_comment(
          community,
          thread,
          post.inner_id,
          mock_comment("solution"),
          post_author
        )

      {:ok, solution_comment} = CMS.Comments.mark_comment_solution(comment.id, post_author)

      Process.sleep(1000)

      {:ok, comment} =
        CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

      {:ok, _pinned_comment2} = CMS.Comments.pin_comment(comment.id)

      variables = %{
        article: %{inner_id: post.inner_id, community: post.community_slug, thread: "POST"},
        filter: %{page: 1, size: 10}
      }

      results = guest_conn |> gq_query(@query, variables)

      assert results["entries"] |> List.first() |> Map.get("id") == to_string(solution_comment.id)
      assert results["totalCount"] == total_count + 3
    end

    test "guest user can get paged comment with floor it", ~m(guest_conn community post user)a do
      total_count = 5
      thread = :post
      page_size = 10

      Enum.reduce(1..total_count, [], fn _, acc ->
        {:ok, comment} =
          CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

        Process.sleep(1000)
        acc ++ [comment]
      end)

      variables = %{
        article: %{inner_id: post.inner_id, community: post.community_slug, thread: "POST"},
        filter: %{page: 1, size: page_size}
      }

      results = guest_conn |> gq_query(@query, variables)

      assert results["entries"] |> List.first() |> Map.get("floor") == 1
      assert results["entries"] |> List.last() |> Map.get("floor") == 5
    end

    test "the comments is loaded in default asc order", ~m(guest_conn community post user)a do
      page_size = 10
      thread = :post

      {:ok, comment} =
        CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

      Process.sleep(1000)

      {:ok, _comment2} =
        CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

      Process.sleep(1000)

      {:ok, comment3} =
        CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

      variables = %{
        article: %{inner_id: post.inner_id, community: post.community_slug, thread: "POST"},
        filter: %{page: 1, size: page_size},
        mode: "TIMELINE"
      }

      results = guest_conn |> gq_query(@query, variables)

      assert List.first(results["entries"]) |> Map.get("id") == to_string(comment.id)
      assert List.last(results["entries"]) |> Map.get("id") == to_string(comment3.id)
    end

    test "the comments can be loaded in desc order in timeline-mode",
         ~m(guest_conn community post user)a do
      page_size = 10
      thread = :post

      {:ok, comment} =
        CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

      Process.sleep(1000)

      {:ok, _comment2} =
        CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

      Process.sleep(1000)

      {:ok, comment3} =
        CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

      variables = %{
        article: %{inner_id: post.inner_id, community: post.community_slug, thread: "POST"},
        filter: %{page: 1, size: page_size, sort: "DESC_INSERTED"},
        mode: "TIMELINE"
      }

      results = guest_conn |> gq_query(@query, variables)

      assert List.first(results["entries"]) |> Map.get("id") == to_string(comment3.id)
      assert List.last(results["entries"]) |> Map.get("id") == to_string(comment.id)
    end

    test "the comments can be loaded in desc order in replies-mode",
         ~m(guest_conn community post user user2)a do
      page_size = 10
      thread = :post

      {:ok, comment} =
        CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

      {:ok, _reply_comment} = CMS.Comments.reply_comment(comment.id, mock_comment(), user)
      {:ok, _reply_comment} = CMS.Comments.reply_comment(comment.id, mock_comment(), user2)
      Process.sleep(1000)

      {:ok, comment2} =
        CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

      {:ok, _reply_comment} = CMS.Comments.reply_comment(comment2.id, mock_comment(), user)
      {:ok, _reply_comment} = CMS.Comments.reply_comment(comment2.id, mock_comment(), user2)
      Process.sleep(1000)

      {:ok, comment3} =
        CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

      {:ok, _reply_comment} = CMS.Comments.reply_comment(comment3.id, mock_comment(), user)
      {:ok, _reply_comment} = CMS.Comments.reply_comment(comment3.id, mock_comment(), user2)

      variables = %{
        article: %{inner_id: post.inner_id, community: post.community_slug, thread: "POST"},
        filter: %{page: 1, size: page_size, sort: "DESC_INSERTED"}
      }

      results = guest_conn |> gq_query(@query, variables)

      assert List.first(results["entries"]) |> Map.get("id") == to_string(comment3.id)
      assert List.last(results["entries"]) |> Map.get("id") == to_string(comment.id)
    end

    test "guest user can get paged comment with upvotes_count",
         ~m(guest_conn community post user user2)a do
      total_count = 10
      page_size = 10
      thread = :post

      all_comment =
        Enum.reduce(1..total_count, [], fn i, acc ->
          {:ok, comment} =
            CMS.Comments.create_comment(
              community,
              thread,
              post.inner_id,
              mock_comment("comment #{i}"),
              user
            )

          Process.sleep(1000)
          acc ++ [comment]
        end)

      upvote_comment = all_comment |> Enum.at(3)
      upvote_comment2 = all_comment |> Enum.at(4)
      {:ok, _} = CMS.Comments.upvote_comment(upvote_comment.id, user)
      {:ok, _} = CMS.Comments.upvote_comment(upvote_comment2.id, user)
      {:ok, _} = CMS.Comments.upvote_comment(upvote_comment2.id, user2)

      variables = %{
        article: %{inner_id: post.inner_id, community: post.community_slug, thread: "POST"},
        filter: %{page: 1, size: page_size}
      }

      results = guest_conn |> gq_query(@query, variables)

      assert results["entries"] |> Enum.at(3) |> Map.get("upvotesCount") == 1
      assert results["entries"] |> Enum.at(4) |> Map.get("upvotesCount") == 2
      assert results["entries"] |> List.first() |> Map.get("upvotesCount") == 0
      assert results["entries"] |> List.last() |> Map.get("upvotesCount") == 0
    end

    test "article author upvote a comment can get is_article_author and/or is_article_author_upvoted flag",
         ~m(guest_conn community post user2)a do
      total_count = 5
      page_size = 12
      thread = :post

      author_user = post.author.user

      all_comments =
        Enum.reduce(0..total_count, [], fn i, acc ->
          {:ok, comment} =
            CMS.Comments.create_comment(
              community,
              thread,
              post.inner_id,
              mock_comment("comment #{i}"),
              user2
            )

          acc ++ [comment]
        end)

      random_comment = all_comments |> Enum.at(Enum.random(0..(total_count - 1)))
      {:ok, _} = CMS.Comments.upvote_comment(random_comment.id, author_user)

      {:ok, author_comment} =
        CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), author_user)

      {:ok, _} = CMS.Comments.upvote_comment(author_comment.id, author_user)

      variables = %{
        article: %{inner_id: post.inner_id, community: post.community_slug, thread: "POST"},
        filter: %{page: 1, size: page_size}
      }

      results = guest_conn |> gq_query(@query, variables)

      the_author_comment =
        Enum.find(results["entries"], &(&1["id"] == to_string(author_comment.id)))

      assert the_author_comment["isArticleAuthor"]
      assert the_author_comment |> get_in(["meta", "isArticleAuthorUpvoted"])

      the_random_comment =
        Enum.find(results["entries"], &(&1["id"] == to_string(random_comment.id)))

      #
      assert not the_random_comment["isArticleAuthor"]
      assert the_random_comment |> get_in(["meta", "isArticleAuthorUpvoted"])
    end

    test "guest user can get paged comment with emotions info",
         ~m(guest_conn community post user user2)a do
      total_count = 2
      page_size = 10
      thread = :post

      all_comment =
        Enum.reduce(1..total_count, [], fn i, acc ->
          {:ok, comment} =
            CMS.Comments.create_comment(
              community,
              thread,
              post.inner_id,
              mock_comment("comment #{i}"),
              user
            )

          Process.sleep(1000)
          acc ++ [comment]
        end)

      comment = all_comment |> Enum.at(0)
      comment2 = all_comment |> Enum.at(1)

      {:ok, _} = CMS.Comments.emotion_to_comment(comment.id, :downvote, user)
      {:ok, _} = CMS.Comments.emotion_to_comment(comment.id, :downvote, user2)
      {:ok, _} = CMS.Comments.emotion_to_comment(comment2.id, :beer, user2)

      variables = %{
        article: %{inner_id: post.inner_id, community: post.community_slug, thread: "POST"},
        filter: %{page: 1, size: page_size}
      }

      results = guest_conn |> gq_query(@query, variables)

      comment_emotion =
        Enum.find(results["entries"], &(&1["id"] == to_string(comment.id))) |> Map.get("emotions")

      assert is_nil(emotion_entry(comment_emotion, :popcorn))

      downvote_emotion = emotion_entry(comment_emotion, :downvote)
      assert downvote_emotion["count"] == 2
      assert downvote_emotion["latestUsers"] |> length == 2
      assert not downvote_emotion["viewerHasReacted"]

      latest_downvote_users_logins =
        Enum.map(downvote_emotion["latestUsers"], & &1["login"])

      assert user.login in latest_downvote_users_logins
      assert user2.login in latest_downvote_users_logins

      comment2_emotion =
        Enum.find(results["entries"], &(&1["id"] == to_string(comment2.id)))
        |> Map.get("emotions")

      beer_emotion = emotion_entry(comment2_emotion, :beer)
      assert beer_emotion["count"] == 1
      assert beer_emotion["latestUsers"] |> length == 1
      assert not beer_emotion["viewerHasReacted"]

      latest_beer_users_logins = Enum.map(beer_emotion["latestUsers"], & &1["login"])
      assert user2.login in latest_beer_users_logins
    end

    test "user make emotion can get paged comment with emotions has_motioned field",
         ~m(user_conn community post user user2)a do
      total_count = 10
      page_size = 12
      thread = :post

      all_comment =
        Enum.reduce(1..total_count, [], fn i, acc ->
          {:ok, comment} =
            CMS.Comments.create_comment(
              community,
              thread,
              post.inner_id,
              mock_comment("comment #{i}"),
              user
            )

          Process.sleep(1000)
          acc ++ [comment]
        end)

      comment = all_comment |> Enum.at(0)
      comment2 = all_comment |> Enum.at(1)

      {:ok, _} = CMS.Comments.emotion_to_comment(comment.id, :downvote, user)
      {:ok, _} = CMS.Comments.emotion_to_comment(comment2.id, :downvote, user2)

      variables = %{
        article: %{inner_id: post.inner_id, community: post.community_slug, thread: "POST"},
        filter: %{page: 1, size: page_size}
      }

      results = user_conn |> gq_query(@query, variables)

      assert Enum.find(results["entries"], &(&1["id"] == to_string(comment.id)))
             |> Map.get("emotions")
             |> emotion_entry(:downvote)
             |> Map.get("viewerHasReacted")
    end

    test "comment should have viewer has upvoted flag", ~m(user_conn community post user)a do
      total_count = 10
      page_size = 12
      thread = :post

      all_comments =
        Enum.reduce(0..total_count, [], fn i, acc ->
          {:ok, comment} =
            CMS.Comments.create_comment(
              community,
              thread,
              post.inner_id,
              mock_comment("comment #{i}"),
              user
            )

          acc ++ [comment]
        end)

      random_comment = all_comments |> Enum.at(Enum.random(0..(total_count - 1)))

      {:ok, _} = CMS.Comments.upvote_comment(random_comment.id, user)

      variables = %{
        article: %{inner_id: post.inner_id, community: post.community_slug, thread: "POST"},
        filter: %{page: 1, size: page_size}
      }

      results = user_conn |> gq_query(@query, variables)

      upvoted_comment = Enum.find(results["entries"], &(&1["id"] == to_string(random_comment.id)))

      assert upvoted_comment["viewerHasUpvoted"]
    end
  end

  describe "paged participants" do
    @query """
      query($article: ArticleRefInput!, $filter: PagiFilter!) {
        pagedCommentsParticipants(article: $article, filter: $filter) {
          entries {
            id
            nickname
          }
          totalPages
          totalCount
          pageSize
          pageNumber
        }
    }
    """
    test "guest user can get paged participants", ~m(guest_conn community post user)a do
      total_count = 30
      page_size = 10
      thread = "POST"

      Enum.reduce(1..total_count, [], fn _, acc ->
        {:ok, new_user} = db_insert(:user)

        {:ok, comment} =
          CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), new_user)

        acc ++ [comment]
      end)

      {:ok, _} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      {:ok, _} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

      variables = %{
        article: %{inner_id: post.inner_id, community: post.community_slug, thread: thread},
        filter: %{page: 1, size: page_size}
      }

      results = guest_conn |> gq_query(@query, variables)

      assert results |> is_valid_pagination?
      assert results["totalCount"] == total_count + 1
    end
  end

  describe "paged replies" do
    @query """
      query($id: ID!, $filter: CommentsFilter!) {
        pagedCommentReplies(id: $id, filter: $filter) {
          entries {
            id
            bodyHtml
            author {
              id
              nickname
            }
            upvotesCount
            emotions {
              type
              count
              latestUsers {
                login
                nickname
              }
              viewerHasReacted
            }
            isArticleAuthor
            meta {
              isArticleAuthorUpvoted
            }
            repliesCount
            viewerHasUpvoted
          }
          totalPages
          totalCount
          pageSize
          pageNumber
        }
    }
    """
    test "guest user can get paged replies", ~m(guest_conn community post user user2)a do
      total_count = 2
      page_size = 10
      thread = :post

      author_user = post.author.user

      {:ok, parent_comment} =
        CMS.Comments.create_comment(community, thread, post.inner_id, mock_comment(), user)

      Enum.reduce(1..total_count, [], fn i, acc ->
        {:ok, reply_comment} =
          CMS.Comments.reply_comment(parent_comment.id, mock_comment("reply #{i}"), user2)

        acc ++ [reply_comment]
      end)

      {:ok, author_reply_comment} =
        CMS.Comments.reply_comment(parent_comment.id, mock_comment("author reply"), author_user)

      variables = %{id: parent_comment.id, filter: %{page: 1, size: page_size}}
      results = guest_conn |> gq_query(@query, variables)

      author_reply_comment =
        Enum.find(results["entries"], &(&1["id"] == to_string(author_reply_comment.id)))

      assert author_reply_comment["isArticleAuthor"]
      assert results["entries"] |> length == total_count + 1
    end
  end
end
