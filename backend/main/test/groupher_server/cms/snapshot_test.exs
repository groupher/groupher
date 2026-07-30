defmodule GroupherServer.Test.CMS.SnapshotTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Snapshot
  alias Helper.Cache

  describe "[cms snapshot]" do
    setup do
      Cache.clear(:snapshot)
      :ok
    end

    test "stale-first returns original user snapshots on cache miss" do
      {:ok, user} = db_insert(:user, nickname: "fresh nickname")

      snapshot = %{id: user.id, login: user.login, nickname: "old nickname", avatar: "old.png"}

      assert [resolved] = Snapshot.users([snapshot])
      assert resolved.nickname == "old nickname"
      assert resolved.login == user.login
    end

    test "stale-first patches user snapshots from cache without changing order or length" do
      {:ok, user} = db_insert(:user, nickname: "fresh nickname")

      Cache.put(:snapshot, "snapshot:user:#{user.id}", %{
        id: user.id,
        login: user.login,
        nickname: "cached nickname",
        avatar: "cached.png"
      })

      snapshots = [
        %{id: 123_456, login: "missing", nickname: "missing"},
        %{id: user.id, login: "old", nickname: "old nickname", avatar: "old.png"}
      ]

      assert [first, second] = Snapshot.users(snapshots)
      assert first.login == "missing"
      assert second.login == user.login
      assert second.nickname == "cached nickname"
      assert length([first, second]) == 2
    end

    test "blocking mode loads fresh user summaries and stores them in cache" do
      {:ok, user} = db_insert(:user, nickname: "fresh nickname", shortbio: "short")

      assert [resolved] =
               Snapshot.users(
                 [%{id: user.id, login: "old", nickname: "old nickname"}],
                 mode: :blocking
               )

      assert resolved.login == user.login
      assert resolved.nickname == "fresh nickname"
      assert resolved.shortbio == "short"
      assert {:ok, cached} = Cache.get(:snapshot, "snapshot:user:#{user.id}")
      assert cached.nickname == "fresh nickname"
    end

    test "default article list keeps upvoted user snapshots stale after profile update" do
      {:ok, user1} = db_insert(:user, nickname: "first nickname")
      {:ok, user2} = db_insert(:user, nickname: "second nickname")
      {:ok, user3} = db_insert(:user, nickname: "third nickname")
      {community, post, _attrs, _author} = mock_article(:post)

      {:ok, _} = CMS.Articles.upvote(post, user1)
      {:ok, _} = CMS.Articles.upvote(post, user2)
      {:ok, _} = CMS.Articles.upvote(post, user3)

      {:ok, first_page} =
        CMS.Articles.page(:post, %{
          community: community.slug,
          order: :upvotes,
          page: 1,
          size: 10
        })

      first_nicknames = first_page |> first_entry() |> latest_upvoted_nicknames()
      assert first_nicknames === ["third nickname", "second nickname", "first nickname"]

      {:ok, _updated_user2} = ORM.update(user2, %{nickname: "updated second nickname"})

      {:ok, second_page} =
        CMS.Articles.page(:post, %{
          community: community.slug,
          order: :upvotes,
          page: 1,
          size: 10
        })

      assert second_page |> first_entry() |> latest_upvoted_nicknames() === first_nicknames
    end

    test "blocking user snapshots expose profile changes immediately" do
      {:ok, user} = db_insert(:user, nickname: "old nickname")

      snapshot = %{id: user.id, login: user.login, nickname: "old nickname"}

      {:ok, _updated_user} = ORM.update(user, %{nickname: "new nickname"})

      assert [%{nickname: "old nickname"}] = Snapshot.users([snapshot])
      assert [%{nickname: "new nickname"}] = Snapshot.users([snapshot], mode: :blocking)
      assert [%{nickname: "new nickname"}] = Snapshot.users([snapshot])
    end

    test "job refresh makes stale-first user snapshots converge" do
      {:ok, user} = db_insert(:user, nickname: "old nickname")

      snapshot = %{id: user.id, login: user.login, nickname: "old nickname"}

      {:ok, _updated_user} = ORM.update(user, %{nickname: "new nickname"})

      assert [%{nickname: "old nickname"}] = Snapshot.users([snapshot])
      assert :ok = Snapshot.perform_refresh(:user, [user.id], [])
      assert [%{nickname: "new nickname"}] = Snapshot.users([snapshot])
    end

    test "users_in patches nested user arrays only at requested paths" do
      {:ok, user} = db_insert(:user, nickname: "fresh nickname")

      Cache.put(:snapshot, "snapshot:user:#{user.id}", %{
        id: user.id,
        login: user.login,
        nickname: "cached nickname"
      })

      items = [
        %{
          meta: %{
            latest_upvoted_users: [%{id: user.id, login: "old", nickname: "old nickname"}],
            latest_collected_users: [%{id: user.id, login: "old", nickname: "old nickname"}]
          }
        }
      ]

      assert [item] = Snapshot.users_in(items, [[:meta, :latest_upvoted_users]])

      assert get_in(item, [:meta, :latest_upvoted_users, Access.at(0), :nickname]) ==
               "cached nickname"

      assert get_in(item, [:meta, :latest_collected_users, Access.at(0), :nickname]) ==
               "old nickname"
    end

    test "default articles keep stale snapshots on cache miss" do
      {_community, post, _attrs, _user} = mock_article(:post)

      snapshot = %{id: post.id, title: "old article title", thread: :post}

      {:ok, _updated_post} = ORM.update(post, %{title: "new article title"})

      assert [%{title: "old article title"}] = Snapshot.articles(:post, [snapshot])
    end

    test "blocking articles keep unavailable placeholders for missing rows" do
      {_community, post, _attrs, _user} = mock_article(:post)

      snapshots = [
        %{id: post.id, title: "old title"},
        %{id: 123_456, title: "old missing title"}
      ]

      assert [fresh, missing] = Snapshot.articles(:post, snapshots, mode: :blocking)
      assert fresh.title == post.title
      assert fresh.thread == :post
      assert missing.title == "Unavailable article"
      assert missing.unavailable == true
    end

    test "blocking articles expose title changes immediately" do
      {_community, post, _attrs, _user} = mock_article(:post)

      snapshot = %{id: post.id, title: "old article title", thread: :post}

      {:ok, _updated_post} = ORM.update(post, %{title: "new article title"})

      assert [%{title: "new article title"}] =
               Snapshot.articles(:post, [snapshot], mode: :blocking)
    end

    test "article snapshots do not use user_id as an id fallback" do
      {_community, post, _attrs, _user} = mock_article(:post)

      snapshot = %{user_id: post.id, title: "old article title", thread: :post}

      assert [%{title: "old article title"}] =
               Snapshot.articles(:post, [snapshot], mode: :blocking)
    end

    test "articles_in patches single snapshot fields" do
      {_community, post, _attrs, _user} = mock_article(:post)

      Cache.put(:snapshot, "snapshot:article:post:#{post.id}", %{
        id: post.id,
        title: "cached article title",
        thread: :post
      })

      refs = [
        %{
          article: %{id: post.id, title: "old article title", thread: :post},
          other_article: %{id: post.id, title: "other old title", thread: :post}
        }
      ]

      assert [ref] = Snapshot.articles_in(:post, refs, [:article])
      assert ref.article.title == "cached article title"
      assert ref.other_article.title == "other old title"
    end

    test "default comments keep stale snapshots while blocking loads current digest" do
      {community, post, _attrs, user} = mock_article(:post)

      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment("fresh"), user)

      snapshot = %{id: comment.id, body_digest: "old digest", article_id: post.id, thread: :post}

      assert [%{body_digest: "old digest"}] = Snapshot.comments(:post, [snapshot])
      assert [fresh] = Snapshot.comments(:post, [snapshot], mode: :blocking)
      assert fresh.body_digest == comment.body
      assert fresh.article_id == post.id
    end

    test "comments use character length when building digest" do
      {community, post, _attrs, user} = mock_article(:post)
      body = String.duplicate("文", 121)

      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(body), user)

      assert [fresh] =
               Snapshot.comments(
                 :post,
                 [
                   %{
                     id: comment.id,
                     body_digest: "old digest",
                     article_id: post.id,
                     thread: :post
                   }
                 ],
                 mode: :blocking
               )

      assert String.length(fresh.body_digest) == 120
    end

    test "comments_in patches list and single snapshot fields" do
      {community, post, _attrs, user} = mock_article(:post)

      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment("fresh"), user)

      Cache.put(:snapshot, "snapshot:comment:post:#{comment.id}", %{
        id: comment.id,
        body_digest: "cached digest",
        thread: :post
      })

      items = [
        %{
          comment_snapshots: [
            %{id: comment.id, body_digest: "old digest", article_id: post.id, thread: :post}
          ],
          replying_to: %{
            id: comment.id,
            body_digest: "old reply",
            article_id: post.id,
            thread: :post
          }
        }
      ]

      assert [item] =
               Snapshot.comments_in(:post, items, [
                 :comment_snapshots,
                 :replying_to
               ])

      assert item.comment_snapshots |> List.first() |> Map.get(:body_digest) == "cached digest"
      assert item.replying_to.body_digest == "cached digest"
    end

    test "blocking comments mark deleted rows as unavailable" do
      {community, post, _attrs, user} = mock_article(:post)

      {:ok, comment} =
        CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment("fresh"), user)

      {:ok, _deleted_comment} = ORM.update(comment, %{is_deleted: true})

      snapshot = %{id: comment.id, body_digest: "old digest", article_id: post.id, thread: :post}

      assert [deleted] = Snapshot.comments(:post, [snapshot], mode: :blocking)
      assert deleted.body_digest == "this comment is deleted"
      assert deleted.unavailable == true
    end
  end

  defp first_entry(%{entries: [entry | _]}), do: entry

  defp latest_upvoted_nicknames(article) do
    article
    |> get_in([Access.key(:meta), Access.key(:latest_upvoted_users)])
    |> Enum.map(& &1.nickname)
  end
end
