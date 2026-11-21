defmodule GroupherServer.Test.Accounts.Publish.Doc do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.Accounts
  alias Accounts.Publish, as: Accounts

  @publish_count 10

  setup do
    {community, doc, _, user} = mock_article(:doc)

    {:ok, user2} = db_insert(:user)
    community2_attrs = mock_attrs(:community)
    {:ok, community2} = CMS.Communities.create(community2_attrs, user, Ecto.UUID.generate())

    {:ok, ~m(user user2 doc community community2)a}
  end

  describe "[published docs]" do
    test "create doc should update user published meta", ~m(community user2)a do
      doc_attrs = mock_attrs(:doc, %{community_id: community.id})

      {:ok, _} =
        GroupherServer.Support.Factory.create_published_article(community, :doc, doc_attrs, user2,
          command_id: Ecto.UUID.generate()
        )

      {:ok, _} =
        GroupherServer.Support.Factory.create_published_article(
          community,
          :doc,
          mock_attrs(:doc),
          user2, command_id: Ecto.UUID.generate())

      {:ok, user} = ORM.find(User, user2.id)
      assert user.meta.published_docs_count == 2
    end

    test "fresh user get empty paged published docs", ~m(user2)a do
      {:ok, results} =
        Accounts.paged_articles(user2, :doc, %{}, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 20
        })

      assert results.page_info.api == :offset
      assert results.page_info.total_count == 0
    end

    @tag :skip_ci
    test "user can get paged published docs", ~m(user user2 community community2)a do
      pub_docs =
        Enum.reduce(1..@publish_count, [], fn _, acc ->
          doc_attrs = mock_attrs(:doc, %{community_id: community.id})

          {:ok, doc} =
            GroupherServer.Support.Factory.create_published_article(
              community,
              :doc,
              doc_attrs,
              user, command_id: Ecto.UUID.generate())

          acc ++ [doc]
        end)

      pub_docs2 =
        Enum.reduce(1..@publish_count, [], fn _, acc ->
          doc_attrs = mock_attrs(:doc, %{community_id: community2.id})

          {:ok, doc} =
            GroupherServer.Support.Factory.create_published_article(
              community,
              :doc,
              doc_attrs,
              user, command_id: Ecto.UUID.generate())

          acc ++ [doc]
        end)

      # unrelated other user
      Enum.reduce(1..5, [], fn _, acc ->
        doc_attrs = mock_attrs(:doc, %{community_id: community.id})

        {:ok, doc} =
          GroupherServer.Support.Factory.create_published_article(
            community,
            :doc,
            doc_attrs,
            user2, command_id: Ecto.UUID.generate())

        acc ++ [doc]
      end)

      {:ok, results} =
        Accounts.paged_articles(user, :doc, %{}, %GroupherServer.Pagi.Params.Offset{
          page: 1,
          size: 50
        })

      assert results.page_info.api == :offset
      assert results.page_info.total_count == @publish_count * 2 + 1

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
          CMS.Comments.create_comment(
            community,
            :doc,
            article_inner_id(doc, community),
            mock_comment(),
            user,
            Ecto.UUID.generate()
          )

        acc ++ [comment]
      end)

      pagi = %GroupherServer.Pagi.Params.Offset{page: 1, size: 20}
      {:ok, articles} = Accounts.paged_comments(user, :doc, %{}, pagi, user)

      entries = articles.entries
      article = entries |> List.first()

      assert article.article.id == doc.id
      assert article.article.title == doc.title
    end
  end
end
