defmodule GroupherServer.Test.Accounts.Published.Doc do
  @moduledoc false

  use GroupherServer.TestTools

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias Helper.ORM

  @publish_count 10

  setup do
    {community, doc, _, user} = mock_article(:doc)

    {:ok, user2} = db_insert(:user)
    {:ok, community2} = db_insert(:community)

    {:ok, ~m(user user2 doc community community2)a}
  end

  describe "[published docs]" do
    test "create doc should update user published meta", ~m(community user2)a do
      doc_attrs = mock_attrs(:doc, %{community_id: community.id})
      {:ok, _} = CMS.create_article(community, :doc, doc_attrs, user2)
      {:ok, _} = CMS.create_article(community, :doc, doc_attrs, user2)

      {:ok, user} = ORM.find(User, user2.id)
      assert user.meta.published_docs_count == 2
    end

    test "fresh user get empty paged published docs", ~m(user2)a do
      {:ok, results} = Accounts.paged_published_articles(user2, :doc, %{page: 1, size: 20})

      assert results |> is_valid_pagination?(:raw)
      assert results.total_count == 0
    end

    @tag :skip_ci
    test "user can get paged published docs", ~m(user user2 community community2)a do
      pub_docs =
        Enum.reduce(1..@publish_count, [], fn _, acc ->
          doc_attrs = mock_attrs(:doc, %{community_id: community.id})
          {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

          acc ++ [doc]
        end)

      pub_docs2 =
        Enum.reduce(1..@publish_count, [], fn _, acc ->
          doc_attrs = mock_attrs(:doc, %{community_id: community2.id})
          {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

          acc ++ [doc]
        end)

      # unrelated other user
      Enum.reduce(1..5, [], fn _, acc ->
        doc_attrs = mock_attrs(:doc, %{community_id: community.id})
        {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user2)

        acc ++ [doc]
      end)

      {:ok, results} = Accounts.paged_published_articles(user, :doc, %{page: 1, size: 20})

      assert results |> is_valid_pagination?(:raw)
      assert results.total_count == @publish_count * 2 + 1

      random_doc_id = pub_docs |> Enum.random() |> Map.get(:id)
      random_doc_id2 = pub_docs2 |> Enum.random() |> Map.get(:id)
      assert results.entries |> Enum.any?(&(&1.id == random_doc_id))
      assert results.entries |> Enum.any?(&(&1.id == random_doc_id2))
    end
  end

  describe "[published doc comments]" do
    test "can get published article comments", ~m(community doc user)a do
      total_count = 10

      Enum.reduce(1..total_count, [], fn _, acc ->
        {:ok, comment} =
          CMS.create_comment(community, :doc, doc.inner_id, mock_comment(), user)

        acc ++ [comment]
      end)

      filter = %{page: 1, size: 20}
      {:ok, articles} = Accounts.paged_published_comments(user, :doc, filter)

      entries = articles.entries
      article = entries |> List.first()

      assert article.article.id == doc.id
      assert article.article.title == doc.title
    end
  end
end
