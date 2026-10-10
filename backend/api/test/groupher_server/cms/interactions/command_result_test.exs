defmodule GroupherServer.Test.CMS.Interactions.CommandResultTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.ArticleStats

  test "Article reaction result fails when the public stats projection is unavailable" do
    {_community, post, _attrs, user} = mock_article(:post)

    raw_result = CMS.Interactions.upvote(post, user, Ecto.UUID.generate())
    Repo.delete_all(ArticleStats)

    assert {:error, _reason} = CMS.Interactions.CommandResult.build(raw_result, user)
  end

  test "Comment command result fails when the public stats projection is unavailable" do
    {_community, post, _attrs, user} = mock_article(:post)

    raw_result =
      CMS.Comments.create_comment_payload(
        :post,
        post,
        mock_comment(),
        user,
        Ecto.UUID.generate()
      )

    Repo.delete_all(ArticleStats)

    assert {:error, _reason} = CMS.Comments.CommandResult.build(raw_result)
  end
end
