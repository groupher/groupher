defmodule GroupherServer.Test.CMS.Interactions.RegistryConstraintsTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Interactions.Registry
  alias GroupherServer.Repo

  test "registry expansion matches the physical article uniqueness indexes" do
    for thread <- [:post, :blog, :changelog, :doc], interaction <- [:upvote, :collect, :emotion] do
      index_name = Registry.unique_index_name(interaction, thread)

      assert %{rows: [[^index_name]]} =
               Repo.query!(
                 """
                 SELECT indexname
                 FROM pg_indexes
                 WHERE schemaname = 'cms' AND indexname = $1
                 """,
                 [index_name]
               )
    end
  end

  test "comment emotion keeps its target-first legacy index order" do
    assert Registry.unique_index_name(:comment_emotion, :comment) ==
             "comments_users_emotions_comment_id_user_id_emotion_index"
  end
end
