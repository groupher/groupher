defmodule GroupherServer.Test.CMS.Artiment.InteractionMatcherTest do
  use ExUnit.Case, async: true

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Artiment.Matcher
  alias GroupherServer.ErrorCat.Error

  alias GroupherServer.CMS.Model.{
    Comment,
    CommentEmotionInfo,
    CommentReactionInfo,
    Post,
    PostEmotionInfo,
    PostReactionInfo
  }

  test "matches a complete interaction definition by kind, schema, and struct" do
    expected = %{
      artiment: :post,
      model: Post,
      foreign_key: :post_id,
      reaction_info_model: PostReactionInfo,
      emotion_info_model: PostEmotionInfo,
      collection?: true
    }

    assert {:ok, ^expected} = Matcher.match_interaction(:post)
    assert {:ok, ^expected} = Matcher.match_interaction(Post)
    assert {:ok, ^expected} = Matcher.match_interaction(%Post{})
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
