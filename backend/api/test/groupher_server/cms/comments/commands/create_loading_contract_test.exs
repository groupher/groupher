defmodule GroupherServer.Test.CMS.Comments.Commands.CreateLoadingContractTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.{Accounts, CMS}
  alias CMS.Comments.Commands.Create
  alias CMS.Model.Comment
  alias Accounts.Model.User

  test "projection create and both top-level/reply replay reload current canonical resources" do
    {community, article_view, _attrs, user} = mock_article(:post)
    projection = %{article_id: article_view.article_id, community: community}
    create_id = Ecto.UUID.generate()

    assert {:ok, first} =
             Create.create(:post, projection, mock_comment("projection comment"), user, create_id)

    assert first.article.id == article_view.article_id
    assert first.community.id == community.id
    assert %Comment{thread: :post, author: %User{id: author_id}} = first.comment
    assert author_id == user.id

    assert {:ok, replayed} =
             Create.create(:post, projection, mock_comment("projection comment"), user, create_id)

    assert replayed.comment.id == first.comment.id
    assert replayed.article.id == article_view.article_id
    assert replayed.community.id == community.id
    assert replayed.comment.author.id == user.id

    reply_id = Ecto.UUID.generate()

    assert {:ok, first_reply} =
             Create.reply(first.comment, mock_comment("reply"), user, reply_id)

    assert first_reply.comment.reply_to_comment_id == first.comment.id
    assert first_reply.comment.author.id == user.id
    assert first_reply.article.id == article_view.article_id

    assert {:ok, replayed_reply} =
             Create.reply(first.comment, mock_comment("reply"), user, reply_id)

    assert replayed_reply.comment.id == first_reply.comment.id
    assert replayed_reply.comment.reply_to_comment.author.id == user.id
    assert replayed_reply.article.id == article_view.article_id
    assert replayed_reply.community.id == community.id
  end
end
