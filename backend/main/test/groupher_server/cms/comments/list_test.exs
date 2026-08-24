defmodule GroupherServer.Test.CMS.Comments.List do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Model.Post
  alias Helper.ORM

  test "participant projection repair never changes a successful read result" do
    {community, post, _, actor} = mock_article(:post, preload: [author: :user])

    assert {:ok, _comment} =
             CMS.Comments.create_comment(
               community,
               :post,
               post.inner_id,
               mock_comment(),
               actor
             )

    assert {:ok, _post} = ORM.update(post, %{comments_participants_count: 99})

    assert {:ok, page} =
             CMS.Comments.paged_comments_participants(:post, post.id, %{page: 1, size: 20})

    assert page.total_count == 1
    assert [%{id: actor_id}] = page.entries
    assert actor_id == actor.id
    assert Repo.get!(Post, post.id).comments_participants_count == 99
  end
end
