defmodule GroupherServer.Test.CMS.Artiment.InteractionMatcherTest do
  use ExUnit.Case, async: true

  alias GroupherServer.{Accounts, CMS, ErrorCat}
  alias Accounts.Model.User
  alias CMS.Artiment.Matcher
  alias ErrorCat.Error

  alias CMS.Model.{
    Comment,
    CommentEmotionInfo,
    CommentReactionInfo,
    Article,
    PostEmotionInfo,
    PostReactionInfo
  }

  test "matches a complete interaction definition by kind, schema, and struct" do
    expected = %{
      artiment: :post,
      model: Article,
      foreign_key: :article_id,
      reaction_info_model: PostReactionInfo,
      emotion_info_model: PostEmotionInfo,
      collection?: true
    }

    assert {:ok, ^expected} = Matcher.match_interaction(:post)

    assert {:ok, ^expected} = Matcher.match_interaction(%Article{thread: :post})
  end

  test "keeps Comment capabilities explicit" do
    assert {:ok,
            %{
              artiment: :comment,
              model: Comment,
              foreign_key: :comment_id,
              reaction_info_model: CommentReactionInfo,
              emotion_info_model: CommentEmotionInfo,
              collection?: false
            }} = Matcher.match_interaction(Comment)
  end

  test "fails closed for non-Artiment and unknown inputs" do
    assert {:error, %Error{reason: :unsupported_artiment}} =
             Matcher.match_interaction(:account)

    assert {:error, %Error{reason: :unsupported_artiment}} = Matcher.match_interaction(User)
    assert {:error, %Error{reason: :unsupported_artiment}} = Matcher.match_interaction(:unknown)
  end
end
