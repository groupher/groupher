defmodule GroupherServer.Test.CMS.Interactions.RegistryTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Interactions.Registry
  alias GroupherServer.CMS.Model.{ArticleUpvote, PostReactionInfo}

  test "keeps target projections and fact tables in separate metadata layers" do
    assert %{reaction: PostReactionInfo, target_id: :post_id, collection?: true} =
             Registry.target(:post)

    assert %{schema: ArticleUpvote, table: "article_upvotes"} = Registry.fact(:upvote)
    assert Registry.article_table(:post) == "posts"
  end

  test "expands semantic uniqueness into the concrete target index" do
    assert Registry.unique_columns(:upvote, :post) == [:user_id, :post_id]
    assert Registry.unique_columns(:emotion, :blog) == [:user_id, :blog_id, :emotion]

    assert Registry.unique_index_name(:upvote, :post) ==
             "article_upvotes_user_id_post_id_index"

    assert Registry.unique_index_name(:emotion, :doc) ==
             "article_user_emotions_user_id_doc_id_emotion_index"
  end
end
