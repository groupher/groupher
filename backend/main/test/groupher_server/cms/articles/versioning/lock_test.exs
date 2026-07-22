defmodule GroupherServer.Test.CMS.Articles.Versioning.Lock do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Articles.Lock

  test "Preview promotion waits for the same logical Article lifecycle lock" do
    {community, _existing_post, attrs, user} = mock_article(:post)

    {:ok, draft} =
      CMS.Articles.create_draft(
        community,
        :post,
        Map.merge(attrs, %{
          title: "Lock Base",
          body_bag: mock_body_bag(mock_rich_text("lock base"))
        }),
        user
      )

    {:ok, _published} =
      CMS.Articles.publish_draft(community, :post, draft.article_hash_id, user)

    {:ok, forked} =
      CMS.Articles.fork_preview(
        community,
        :post,
        draft.article_hash_id,
        %{slug: "lock-preview", title: "Lock Preview"},
        user
      )

    parent = self()

    holder =
      Task.async(fn ->
        Lock.run(community, :post, draft.article_hash_id, fn ->
          send(parent, :article_lock_acquired)

          receive do
            :release_article_lock -> {:ok, :released}
          end
        end)
      end)

    assert_receive :article_lock_acquired

    promoter =
      Task.async(fn ->
        result =
          CMS.Articles.promote_preview(
            community,
            :post,
            draft.article_hash_id,
            forked.branch,
            user
          )

        send(parent, {:promotion_finished, result})
        result
      end)

    refute_receive {:promotion_finished, _}, 100
    send(holder.pid, :release_article_lock)

    assert {:ok, :released} = Task.await(holder)
    assert {:ok, %{snapshot: %{action: :promote}}} = Task.await(promoter)
    assert_receive {:promotion_finished, {:ok, _}}
  end
end
