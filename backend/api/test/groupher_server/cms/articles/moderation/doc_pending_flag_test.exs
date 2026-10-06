defmodule GroupherServer.Test.CMS.DocPendingFlag do
  @moduledoc false

  use GroupherServer.TestMate
  alias GroupherServer.CMS

  @total_count 35

  setup do
    {:ok, user} = db_insert(:user)

    {:ok, community} = mock_community(user)
    {:ok, community2} = mock_community(user)

    {_, _, _, _} = mock_article(:doc, community2, user)

    docs =
      Enum.reduce(1..@total_count, [], fn _, acc ->
        {:ok, value} = CMS.Articles.create(community, :doc, mock_attrs(:doc), user)
        acc ++ [value]
      end)

    docs_b = docs |> List.first()
    docs_m = docs |> Enum.at(div(@total_count, 2))
    docs_e = docs |> List.last()

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community user docs_b docs_m docs_e)a}
  end

  describe "[pending docs flags]" do
    test "pending doc can not be read", ~m(docs_m)a do
      {:ok, _} =
        read_article(
          article_community(docs_m),
          :doc,
          docs_m.inner_id
        )

      {:ok, _} =
        CMS.Articles.set_illegal(
          docs_m.article_id,
          %{
            is_legal: false,
            illegal_reason: ["some-reason"],
            illegal_words: ["some-word"]
          },
          :operations,
          branch_id: docs_m.branch_id
        )

      state =
        Repo.get_by!(CMS.Model.DocBranchState,
          article_id: docs_m.article_id,
          branch_id: docs_m.branch_id
        )

      assert state.moderation_state == :illegal

      {:error, reason} =
        read_article(
          article_community(docs_m),
          :doc,
          docs_m.inner_id
        )

      assert reason |> is_error?({{:cms, :article}, :pending})
    end

    test "author can read it's own pending doc", ~m(community user)a do
      docs_attrs = mock_attrs(:doc, %{community_id: community.id})
      {:ok, doc} = CMS.Articles.create(community, :doc, docs_attrs, user)

      {:ok, _} =
        read_article(article_community(doc), :doc, doc.inner_id)

      {:ok, _} =
        CMS.Articles.set_illegal(
          doc.article_id,
          %{
            is_legal: false,
            illegal_reason: ["some-reason"],
            illegal_words: ["some-word"]
          },
          :operations,
          branch_id: doc.branch_id
        )

      {:ok, docs_read} =
        read_article(
          article_community(doc),
          :doc,
          doc.inner_id,
          user
        )

      assert docs_read.id == doc.id

      {:ok, user2} = db_insert(:user)

      {:error, reason} =
        read_article(
          article_community(doc),
          :doc,
          doc.inner_id,
          user2
        )

      assert reason |> is_error?({{:cms, :article}, :pending})
    end

    test "pending doc can set/unset pending", ~m(docs_m)a do
      {:ok, _} =
        read_article(
          article_community(docs_m),
          :doc,
          docs_m.inner_id
        )

      {:ok, _} =
        CMS.Articles.set_illegal(
          docs_m.article_id,
          %{
            is_legal: false,
            illegal_reason: ["some-reason"],
            illegal_words: ["some-word"]
          },
          :operations,
          branch_id: docs_m.branch_id
        )

      state =
        Repo.get_by!(CMS.Model.DocBranchState,
          article_id: docs_m.article_id,
          branch_id: docs_m.branch_id
        )

      assert state.moderation_state == :illegal

      {:ok, _} =
        CMS.Articles.unset_illegal(docs_m.article_id, %{}, :operations,
          branch_id: docs_m.branch_id
        )

      state =
        Repo.get_by!(CMS.Model.DocBranchState,
          article_id: docs_m.article_id,
          branch_id: docs_m.branch_id
        )

      assert state.moderation_state == :legal

      {:ok, _} =
        read_article(
          article_community(docs_m),
          :doc,
          docs_m.inner_id
        )
    end

    test "pending doc's meta should have info", ~m(docs_m)a do
      {:ok, _} =
        read_article(
          article_community(docs_m),
          :doc,
          docs_m.inner_id
        )

      {:ok, _} =
        CMS.Articles.set_illegal(
          docs_m.article_id,
          %{
            is_legal: false,
            illegal_reason: ["some-reason"],
            illegal_words: ["some-word"],
            illegal_articles: ["/doc/#{docs_m.id}"]
          },
          :operations,
          branch_id: docs_m.branch_id
        )

      state =
        Repo.get_by!(CMS.Model.DocBranchState,
          article_id: docs_m.article_id,
          branch_id: docs_m.branch_id
        )

      assert state.moderation_state == :illegal
      assert state.illegal_reason == "some-reason"
      assert state.illegal_words == ["some-word"]

      stable = Repo.get!(CMS.Model.Article, docs_m.article_id) |> Repo.preload(author: :user)
      user = stable.author.user
      assert user.meta.has_illegal_articles
      assert user.meta.illegal_articles == ["/doc/#{docs_m.id}"]

      {:ok, _} =
        CMS.Articles.unset_illegal(
          docs_m.article_id,
          %{
            is_legal: true,
            illegal_reason: [],
            illegal_words: [],
            illegal_articles: ["/doc/#{docs_m.id}"]
          },
          :operations,
          branch_id: docs_m.branch_id
        )

      state =
        Repo.get_by!(CMS.Model.DocBranchState,
          article_id: docs_m.article_id,
          branch_id: docs_m.branch_id
        )

      assert state.moderation_state == :legal
      assert is_nil(state.illegal_reason)
      assert state.illegal_words == []

      stable = Repo.get!(CMS.Model.Article, docs_m.article_id) |> Repo.preload(author: :user)
      user = stable.author.user
      assert not user.meta.has_illegal_articles
      assert user.meta.illegal_articles == []
    end
  end

  # alias CMS.Delegate.Hooks

  # test "can audit paged audit failed docs", ~m(docs_m)a do
  #   {:ok, doc} = ORM.find(Doc, docs_m.id)

  #   {:ok, doc} = CMS.set_article_audit_failed(doc, %{})

  #   {:ok, result} = CMS.paged_audit_failed_articles(:doc, %{page: 1, size: 20})
  #   assert result |> is_valid_pagination?(:raw)
  #   assert result.total_count == 1

  #   Enum.map(result.entries, fn doc ->
  #     Hooks.Audition.handle(doc)
  #   end)

  #   {:ok, result} = CMS.paged_audit_failed_articles(:doc, %{page: 1, size: 20})
  #   assert result.total_count == 0
  # end
end
