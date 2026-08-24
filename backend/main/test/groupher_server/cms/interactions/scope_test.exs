defmodule GroupherServer.Test.CMS.Interactions.ScopeTest do
  use ExUnit.Case, async: true

  import Ecto.Query

  alias GroupherServer.CMS.Interactions
  alias GroupherServer.CMS.Articles.Const, as: ArticlesConst
  alias GroupherServer.CMS.Interactions.Const
  alias GroupherServer.CMS.Model.{Comment, Doc, Post, PostReactionInfo}
  alias GroupherServer.ErrorCat.Error

  test "keeps the complete order vocabulary in one owner" do
    assert Const.interaction_order_values() == [:upvotes, :collects]
    assert ArticlesConst.native_order_values() == [:publish, :comments, :views]
    assert ArticlesConst.order_values() == [:publish, :comments, :views, :upvotes, :collects]
    assert ArticlesConst.valid_order?(nil)
    refute ArticlesConst.valid_order?(:unknown)
  end

  test "infers the Article schema and compiles reaction ordering" do
    base = from(post in Post, where: post.is_legal == true)

    assert {:ok, query} = Interactions.scope(base, order: :upvotes)
    assert query.from.source == {"posts", Post}
    assert [%Ecto.Query.JoinExpr{source: {_source, PostReactionInfo}}] = query.joins
    assert length(query.order_bys) == 1
  end

  test "interaction ordering replaces an existing order so it remains the primary order" do
    base = from(post in Post, order_by: [asc: post.title])

    assert {:ok, query} = Interactions.scope(base, order: :upvotes)
    assert length(query.order_bys) == 1

    [order] = query.order_bys
    rendered = Macro.to_string(order.expr)
    assert rendered =~ "upvotes_count"
    refute rendered =~ "title"
  end

  test "returns validated passthrough queries unchanged" do
    base = Ecto.Queryable.to_query(Doc)

    for order <- [nil, :publish, :comments, :views] do
      assert {:ok, ^base} = Interactions.scope(base, order: order)
    end
  end

  test "fails closed for Comment, non-queryable, and unknown order" do
    assert {:error, %Error{reason: :unsupported_artiment_query}} =
             Interactions.scope(Comment, order: :upvotes)

    assert {:error, %Error{reason: :unsupported_artiment_query}} =
             Interactions.scope(:not_queryable, order: :upvotes)

    assert {:error, %Error{reason: :unsupported_order}} =
             Interactions.scope(Post, order: :unknown)
  end
end
