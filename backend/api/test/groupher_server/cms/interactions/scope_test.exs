defmodule GroupherServer.Test.CMS.Interactions.ScopeTest do
  use ExUnit.Case, async: true

  import Ecto.Query

  alias GroupherServer.{CMS, ErrorCat}
  alias CMS.Interactions
  alias CMS.Articles.Const, as: ArticlesConst
  alias CMS.Interactions.Const
  alias CMS.Model.{Article, ArticleStats, Comment}
  alias ErrorCat.Error

  test "keeps the complete order vocabulary in one owner" do
    assert Const.interaction_order_values() == [:upvotes, :collects]
    assert ArticlesConst.native_order_values() == [:publish, :comments, :views]
    assert ArticlesConst.order_values() == [:publish, :comments, :views, :upvotes, :collects]
    assert ArticlesConst.valid_order?(nil)
    refute ArticlesConst.valid_order?(:unknown)
  end

  test "infers the Article schema and compiles reaction ordering" do
    base = from(article in Article, where: article.moderation_state == :legal)

    assert {:ok, query} = Interactions.scope(base, thread: :post, order: :upvotes)
    assert query.from.source == {"articles", Article}
    assert [%Ecto.Query.JoinExpr{source: {_source, ArticleStats}}] = query.joins
    assert length(query.order_bys) == 1
  end

  test "interaction ordering replaces an existing order so it remains the primary order" do
    base = from(article in Article, order_by: [asc: article.inserted_at])

    assert {:ok, query} = Interactions.scope(base, thread: :post, order: :upvotes)
    assert length(query.order_bys) == 1

    [order] = query.order_bys
    rendered = Macro.to_string(order.expr)
    assert rendered =~ "upvotes_count"
    refute rendered =~ "inserted_at"
  end

  test "returns validated passthrough queries unchanged" do
    base = Ecto.Queryable.to_query(Article)

    for order <- [nil, :publish, :comments, :views] do
      assert {:ok, ^base} = Interactions.scope(base, thread: :doc, order: order)
    end
  end

  test "fails closed for Comment, non-queryable, and unknown order" do
    assert {:error, %Error{reason: :unsupported_artiment_query}} =
             Interactions.scope(Comment, order: :upvotes)

    assert {:error, %Error{reason: :unsupported_artiment_query}} =
             Interactions.scope(:not_queryable, order: :upvotes)

    assert {:error, %Error{reason: :unsupported_order}} =
             Interactions.scope(Article, thread: :post, order: :unknown)
  end
end
