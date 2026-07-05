defmodule GroupherServer.Test.Mutation.Statistics do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.Statistics
  alias Statistics.Model.{CommunityContribute, UserContribute}

  setup do
    {community, post, post_attr, user} = mock_article(:post)
    {:ok, user2} = db_insert(:user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user2)

    {:ok, ~m(guest_conn user_conn community post user user2 post_attr)a}
  end

  describe "[statistics user_contribute] " do
    test "user should have contribute list after create a post",
         ~m(user_conn user2 community post_attr)a do
      variables = %{
        title: post_attr.title,
        body: post_attr.body,
        community: community.slug
      }

      user_conn |> gq_mutation(Schema.m(:create_article, :post), variables)

      {:ok, contributes} = ORM.find_by(UserContribute, user_id: user2.id)
      assert contributes.count == 1
    end

    test "community should have contribute list after create a post",
         ~m(user_conn community post_attr)a do
      variables = %{
        title: post_attr.title,
        body: post_attr.body,
        community: community.slug
      }

      user_conn |> gq_mutation(Schema.m(:create_article, :post), variables)

      {:ok, contributes} = ORM.find_by(CommunityContribute, community_id: community.id)
      assert contributes.count == 1
    end

    test "user should have contribute list after create a blog", ~m(user_conn user2 community)a do
      blog_attr = mock_attrs(:blog)
      variables = blog_attr |> Map.merge(%{community: community.slug}) |> camelize_map_key

      user_conn |> gq_mutation(Schema.m(:create_article, :blog), variables)

      {:ok, contributes} = ORM.find_by(UserContribute, user_id: user2.id)
      assert contributes.count == 1
    end

    @write_comment_query """
    mutation($article: ArticlePathInput!, $body: String!) {
      createComment(article: $article, body: $body) {
        innerId
        bodyHtml
      }
    }
    """
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
