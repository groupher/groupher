defmodule GroupherServer.Test.Helper.ORM do
  @moduledoc false

  use GroupherServer.TestMate

  import GroupherServer.Support.Factory

  alias Accounts.Model.User
  alias CMS.Model.{Author, Post}
  alias Helper.ORM

  @posts_count 20

  setup do
    db_insert_multi(:post, @posts_count)

    {community, post, _, user} = mock_article(:post)

    {:ok, ~m(user post community)a}
  end

  describe "[find/x find_by]" do
    test "find/2 should work, and not preload fields", %{post: post} do
      {:ok, found} = ORM.find(Post, post.id)

      assert found.id == post.id
      assert %Ecto.Association.NotLoaded{} = found.author
    end

    test "find/2 fails with {:error, reason} style" do
      result = ORM.find(Post, 15_982_398_614)

      assert {:error, _} = result
    end

    test "find/3 with preload can preload one field", %{post: post} do
      {:ok, found} = ORM.find(Post, post.id, preload: :author)

      assert found.id == post.id
      assert %Author{} = found.author
    end

    test "find/3 with preload can preload multi fields", %{post: post} do
      {:ok, found} = ORM.find(Post, post.id, preload: [:author, :community_tags, :communities])
      assert %Author{} = found.author
      assert %Ecto.Association.NotLoaded{} != found.community_tags
      assert %Ecto.Association.NotLoaded{} != found.communities
    end

    test "find/3 with preload can preload nested field", %{post: post} do
      {:ok, found} = ORM.find(Post, post.id, preload: [author: :user])

      assert %Author{} = found.author
      assert %User{} = found.author.user
    end

    test "find_by/2 should find a target by given clauses", %{post: post} do
      post_clauses = %{title: post.title}
      {:ok, found} = ORM.find_by(Post, post_clauses)

      assert found.title == post_clauses.title
    end
  end

  test "count should work" do
    assert {:ok, @posts_count + 1} == ORM.count(Post)
  end

  describe "[embeds paginator]" do
    test "filter should work" do
      total_count = 100

      list =
        Enum.reduce(1..total_count, [], fn i, acc ->
          acc ++ ["i-#{i}"]
        end)

      filter = %{page: 1, size: 30}
      result = ORM.embeds_paginator(list, filter)

      assert result |> is_valid_pagination?(:raw)
      assert result.total_count == length(list)
      assert result.page_number == 1
      assert is_list(result.entries)
      assert result.entries |> List.first() == "i-1"
      assert result.entries |> List.last() == "i-30"

      filter = %{page: 4, size: 30}
      result = ORM.embeds_paginator(list, filter)

      assert result.page_number == 4
      assert result.entries |> List.first() == "i-91"
      assert result.entries |> List.last() == "i-100"
    end
  end

  describe "[find article]" do
    test "should find by default args", ~m(community post)a do
      {:ok, article} = CMS.FrontDesk.article(community.slug, :post, post.inner_id)

      assert article.title == post.title
      assert article.id == post.id
      assert article.inner_id == post.inner_id
      assert article.community_slug == community.slug

      assert match?(%Ecto.Association.NotLoaded{}, article.community)
      assert match?(%Ecto.Association.NotLoaded{}, article.author)
    end

    test "should find by preload", ~m(community post)a do
      {:ok, article} =
        CMS.FrontDesk.article(community.slug, :post, post.inner_id,
          preload: [[author: :user], :community]
        )

      assert article.id == post.id
      assert article.inner_id == post.inner_id
      assert article.community_slug == community.slug

      assert not match?(%Ecto.Association.NotLoaded{}, article.community)
      assert article.community.title == community.title
    end

    test "should have error code if not found", ~m(community)a do
      {:error, reason} = CMS.FrontDesk.article(community.slug, :post, 3845)

      assert error_code(reason) == ecode(:article_not_found)
    end
  end

  describe "inc/dec" do
    test "inc/dec should work", ~m(community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, _} = ORM.inc(post, :upvotes_count)
      {:ok, ret} = ORM.inc(post, :upvotes_count)
      assert ret.upvotes_count == 2

      {:ok, ret} = ORM.dec(post, :upvotes_count)
      assert ret.upvotes_count == 1
    end

    test "inc should return error for non-integer field", ~m(community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:error, reason} = ORM.inc(post, :title)
      assert error_code(reason) == ecode(:update_fails)
    end

    test "dec should return error for non-existent field", ~m(community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:error, reason} = ORM.dec(post, :not_a_field)
      assert error_code(reason) == ecode(:update_fails)
    end

    test "dec should below 0", ~m(community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, ret} = ORM.inc(post, :upvotes_count)
      assert ret.upvotes_count == 1

      {:ok, _} = ORM.dec(post, :upvotes_count)
      {:ok, _} = ORM.dec(post, :upvotes_count)
      {:ok, ret} = ORM.dec(post, :upvotes_count)

      assert ret.upvotes_count == 0
    end
  end

  describe "update meta" do
    test "update meta should fill default meta info if need" do
      {:ok, community} = db_insert(:community)
      {:ok, user} = db_insert(:user)

      assert is_nil(community.meta)
      assert is_nil(user.meta)

      {:ok, community} = ORM.update_meta(community, %{})
      {:ok, user} = ORM.update_meta(user, %{})

      assert not is_nil(community.meta)
      assert not is_nil(user.meta)
    end

    test "update meta should work with user", ~m(user)a do
      {:ok, ret} =
        ORM.update_meta(user, %{
          follower_user_ids: [2, 3, 5]
        })

      assert ret.meta.follower_user_ids == [2, 3, 5]
    end

    test "update meta should work with post", ~m(community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, ret} =
        ORM.update_meta(post, %{
          is_edited: true,
          thread: "POST2",
          citing_count: 20,
          is_comment_locked: true,
          upvoted_user_ids: [2, 3, 5],
          last_active_at: post.inserted_at
        })

      assert ret.meta.is_edited == true
      assert ret.meta.is_comment_locked == true
      assert ret.meta.upvoted_user_ids == [2, 3, 5]
      assert ret.meta.citing_count == 20
      assert ret.meta.last_active_at == post.inserted_at
      assert ret.meta.thread == "POST2"
    end

    test "update meta should effect inserted_at", ~m(community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, ret} =
        ORM.update_meta(post, %{
          is_edited: true,
          citing_count: 20
        })

      assert ret.inserted_at == post.inserted_at

      {:ok, fresh_post} = ORM.find(Post, post.id)
      assert post.id == fresh_post.id

      assert ret.inserted_at == fresh_post.inserted_at
      assert post.inserted_at == fresh_post.inserted_at
    end

    test "update meta should work with edge cases", ~m(community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, ret} = ORM.update_meta(post, %{last_active_at: nil})

      assert ret.meta.last_active_at == post.updated_at
    end

    test "update meta should preserve concurrent updates on different paths",
         ~m(community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      parent = self()

      task1 =
        Task.async(fn ->
          send(parent, {:task_ready, self()})

          receive do
            :go -> ORM.update_meta(post, %{"last_active_at" => post.inserted_at})
          end
        end)

      task2 =
        Task.async(fn ->
          send(parent, {:task_ready, self()})

          receive do
            :go -> ORM.update_meta(post, %{is_comment_locked: true})
          end
        end)

      for _ <- 1..2 do
        assert_receive {:task_ready, pid}
        send(pid, :go)
      end

      assert {:ok, _} = Task.await(task1, 5_000)
      assert {:ok, _} = Task.await(task2, 5_000)

      {:ok, fresh_post} = ORM.find(Post, post.id)

      assert fresh_post.meta.is_comment_locked == true
      assert fresh_post.meta.last_active_at == post.inserted_at
    end

    test "update meta follows last write wins on same path", ~m(community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      parent = self()
      first_time = post.inserted_at
      second_time = DateTime.add(post.inserted_at, 60, :second)

      task1 =
        Task.async(fn ->
          send(parent, {:task_ready, self()})

          receive do
            :go -> ORM.update_meta(post, %{"last_active_at" => first_time})
          end
        end)

      task2 =
        Task.async(fn ->
          send(parent, {:task_ready, self()})

          receive do
            :go -> ORM.update_meta(post, %{"last_active_at" => second_time})
          end
        end)

      ready_pids =
        for _ <- 1..2 do
          assert_receive {:task_ready, pid}
          pid
        end

      Enum.each(ready_pids, &send(&1, :go))

      assert {:ok, _} = Task.await(task1, 5_000)
      assert {:ok, _} = Task.await(task2, 5_000)

      {:ok, fresh_post} = ORM.find(Post, post.id)

      assert fresh_post.meta.last_active_at in [first_time, second_time]
    end

    test "update meta should reject nested paths not defined in schema", ~m(community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:error, reason} = ORM.update_meta(post, %{"stats.views" => 42})

      assert error_code(reason) == ecode(:update_fails)
    end
  end

  describe "inc_meta" do
    test "inc_meta should work with post", ~m(community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      # 测试第一次递增
      {:ok, updated_post, new_floor} = ORM.inc_meta(post, :next_floor)
      assert new_floor == 1
      assert updated_post.id == post.id
      assert updated_post.meta.next_floor == 1

      # 测试再次递增
      {:ok, updated_post, new_floor} = ORM.inc_meta(updated_post, :next_floor)
      assert new_floor == 2
      assert updated_post.meta.next_floor == 2
    end

    test "inc_meta should return error for non-integer meta field", ~m(community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:error, reason} = ORM.inc_meta(post, :thread)
      assert error_code(reason) == ecode(:update_fails)
    end

    test "inc_meta should return error for non-existent field", ~m(community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:error, reason} = ORM.inc_meta(post, :non_existent_field)
      assert error_code(reason) == ecode(:update_fails)
    end
  end
end
