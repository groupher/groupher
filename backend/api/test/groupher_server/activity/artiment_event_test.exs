defmodule GroupherServer.Test.Activity.ArtimentEventTest do
  use GroupherServer.TestMate, async: false
  alias GroupherServer.{Activity, CMS, Messaging}
  alias CMS.Events.Notify
  alias Messaging.Model.Notification

  test "MSG-02 Doc body events retain their branch while shared Comment events do not" do
    {community, doc, _, author} = mock_article(:doc)
    {:ok, actor} = db_insert(:user)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :doc,
        doc.inner_id,
        mock_comment(),
        actor,
        Ecto.UUID.generate()
      )

    assert {:ok, descriptor} =
             Activity.Doc.describe(comment, :comment_created, community_id: community.id)

    assert descriptor.article_id == doc.article_id
    assert descriptor.subject_type == "comment"
    refute Map.has_key?(descriptor, :branch_id)
    assert {:ok, body} = Activity.Doc.describe(doc, :published, [])
    assert body.branch_id == doc.branch_id
    assert {:ok, _} = Notify.handle(:comment, comment, actor)
    notification = Repo.get_by!(Notification, comment_id: comment.id, user_id: author.id)
    assert notification.article_id == doc.article_id
    assert notification.branch_id == nil
  end
end
