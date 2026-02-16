defmodule GroupherServer.Test.CMS.Hooks.MentionInDoc do
  @moduledoc false
  use GroupherServer.TestTools

  import Helper.Utils, only: [preload_author: 1]

  alias GroupherServer.Delivery
  alias CMS.Delegate.Hooks

  @article_mention_class "cdx-mention"

  setup do
    {community, doc, doc_attrs, user} = mock_article(:doc)
    {:ok, user2} = db_insert(:user)
    {:ok, user3} = db_insert(:user)

    {:ok, ~m(user user2 user3 community doc doc_attrs)a}
  end

  describe "[mention in doc basic]" do
    test "mention multi user in doc should work",
         ~m(user user2 user3 community  doc_attrs)a do
      body =
        mock_rich_text(
          ~s(hi <div class=#{@article_mention_class}>#{user2.login}</div>, and <div class=#{@article_mention_class}>#{user3.login}</div>),
          ~s(hi <div class=#{@article_mention_class}>#{user2.login}</div>)
        )

      doc_attrs = doc_attrs |> Map.merge(%{body: body})
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)
      {:ok, doc} = preload_author(doc)

      {:ok, _} = Hooks.Mention.handle(doc)

      {:ok, result} = Delivery.fetch(:mention, user2, %{page: 1, size: 10})

      mention = result.entries |> List.first()
      assert mention.thread == "DOC"
      assert mention.block_linker |> length == 2
      assert mention.article_id == doc.id
      assert mention.title == doc.title
      assert mention.user.login == doc.author.user.login

      {:ok, result} = Delivery.fetch(:mention, user3, %{page: 1, size: 10})

      mention = result.entries |> List.first()
      assert mention.thread == "DOC"
      assert mention.block_linker |> length == 1
      assert mention.article_id == doc.id
      assert mention.title == doc.title
      assert mention.user.login == doc.author.user.login
    end

    test "mention in doc's comment should work", ~m(user user2 community doc)a do
      comment_body =
        mock_rich_text(~s(hi <div class=#{@article_mention_class}>#{user2.login}</div>))

      {:ok, comment} =
        CMS.create_comment(community, :doc, doc.inner_id, comment_body, user)

      {:ok, comment} = preload_author(comment)

      {:ok, _} = Hooks.Mention.handle(comment)
      {:ok, result} = Delivery.fetch(:mention, user2, %{page: 1, size: 10})

      mention = result.entries |> List.first()
      assert mention.thread == "DOC"
      assert mention.comment_id == comment.id
      assert mention.block_linker |> length == 1
      assert mention.article_id == doc.id
      assert mention.title == doc.title
      assert mention.user.login == comment.author.login
    end

    test "can not mention author self in doc or comment",
         ~m(community user doc_attrs)a do
      body = mock_rich_text(~s(hi <div class=#{@article_mention_class}>#{user.login}</div>))
      doc_attrs = doc_attrs |> Map.merge(%{body: body})
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

      {:ok, result} = Delivery.fetch(:mention, user, %{page: 1, size: 10})
      assert result.total_count == 0

      comment_body =
        mock_rich_text(~s(hi <div class=#{@article_mention_class}>#{user.login}</div>))

      {:ok, comment} =
        CMS.create_comment(community, :doc, doc.inner_id, comment_body, user)

      {:ok, _} = Hooks.Mention.handle(comment)
      {:ok, result} = Delivery.fetch(:mention, user, %{page: 1, size: 10})

      assert result.total_count == 0
    end
  end
end
