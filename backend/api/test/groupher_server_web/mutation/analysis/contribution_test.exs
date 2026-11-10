defmodule GroupherServer.Test.Mutation.Analysis.Contribution do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.Analysis.Contribution.Model.UserContribute

  setup do
    {community, post, post_attr, user} = mock_article(:post)
    {:ok, user2} = db_insert(:user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user2)

    {:ok, ~m(guest_conn user_conn community post user user2 post_attr)a}
  end

  describe "[article creation] " do
    test "creating a post returns its default WorkingCopy",
         ~m(user_conn community post_attr)a do
      variables = %{
        title: post_attr.title,
        body: post_attr.body,
        community: community.slug,
        thread: "POST"
      }

      created = user_conn |> gq_mutation(S.Article.m(:create_article), variables)
      assert created["revision"] == 1
      assert is_binary(created["id"])
    end

    test "creating a post creates one stable Article identity",
         ~m(user_conn community post_attr)a do
      variables = %{
        title: post_attr.title,
        body: post_attr.body,
        community: community.slug,
        thread: "POST"
      }

      created = user_conn |> gq_mutation(S.Article.m(:create_article), variables)
      assert is_binary(created["articleId"])
    end

    test "creating a blog returns its default WorkingCopy", ~m(user_conn community)a do
      blog_attr = mock_attrs(:blog)

      variables = %{
        title: blog_attr.title,
        body: blog_attr.body,
        community: community.slug,
        thread: "BLOG"
      }

      created = user_conn |> gq_mutation(S.Article.m(:create_article), variables)
      assert created["revision"] == 1
      assert is_binary(created["articleId"])
    end

    @write_comment_query S.Comment.m(:create_comment_2)
    test "user should have contribute list after create a comment",
         ~m(user_conn community post user2)a do
      variables = %{
        article: article_path(community, post, :post),
        body: mock_comment()
      }

      user_conn |> gq_mutation(@write_comment_query, variables)

      {:ok, contributes} = ORM.find_by(UserContribute, user_id: user2.id)
      assert contributes.count == 1
    end
  end
end
