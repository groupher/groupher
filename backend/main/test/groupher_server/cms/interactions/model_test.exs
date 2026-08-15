defmodule GroupherServer.Test.CMS.Interactions.ModelTest do
  use GroupherServer.DataCase, async: true

  alias GroupherServer.CMS.Model.{
    CommentEmotionInfo,
    CommentReactionInfo,
    PostEmotionInfo,
    PostReactionInfo
  }

  test "reaction info schemas expose only their target capabilities" do
    assert :collected_user_ids in PostReactionInfo.__schema__(:fields)
    assert :latest_collected_users in PostReactionInfo.__schema__(:fields)
    refute :collected_user_ids in CommentReactionInfo.__schema__(:fields)
    refute :latest_collected_users in CommentReactionInfo.__schema__(:fields)
  end

  test "reaction and emotion info require their target relation" do
    refute PostReactionInfo.changeset(%PostReactionInfo{}, %{}).valid?
    refute CommentEmotionInfo.changeset(%CommentEmotionInfo{}, %{emotion: "beer"}).valid?
    refute PostEmotionInfo.changeset(%PostEmotionInfo{}, %{post_id: 1}).valid?
  end
end
