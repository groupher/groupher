defmodule GroupherServer.Test.CMS.Articles.DocOwnerConcurrencyTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.Repo
  alias CMS.Model.{Article, ArticleBinding, ArticleHistoryOwner, ArticleLifecycle}

  test "Doc bindings are independent and unbinding retains the shared identity" do
    {owner, doc, _, _} = mock_article(:doc)
    {:ok, other} = db_insert(:community)

    assert {:ok, _binding} =
             Repo.insert(
               ArticleBinding.changeset(%ArticleBinding{}, %{
                 article_id: doc.id,
                 community_id: other.id
               })
             )

    assert Repo.aggregate(
             from(b in ArticleBinding, where: b.article_id == ^doc.id),
             :count
           ) == 2

    assert Repo.get_by!(ArticleHistoryOwner,
             article_id: doc.id,
             community_id: other.id
           )

    Repo.delete!(Repo.get_by!(ArticleBinding, article_id: doc.id, community_id: owner.id))

    assert Repo.get!(Article, doc.id)
    assert Repo.get_by!(ArticleLifecycle, article_id: doc.id)
    assert Repo.get_by!(ArticleHistoryOwner, article_id: doc.id, community_id: owner.id)
    assert Repo.get_by!(ArticleBinding, article_id: doc.id, community_id: other.id)
  end
end
