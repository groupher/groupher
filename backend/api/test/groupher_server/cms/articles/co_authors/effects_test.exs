defmodule GroupherServer.Test.CMS.Articles.CoAuthors.EffectsTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query

  alias GroupherServer.CMS.Articles.CoAuthors.Effects
  alias GroupherServer.CMS.Model.ArticleCoAuthorRequest
  alias GroupherServer.CMS.Outbox.Event
  alias GroupherServer.Jobs.CMSOutboxArticleCoAuthor
  alias GroupherServer.Messaging.Model.Notice

  test "request notice reaches the subject through the durable Outbox path" do
    {:ok, actor} = db_insert(:user)
    {:ok, recipient} = db_insert(:user)

    request = %ArticleCoAuthorRequest{
      id: Ecto.UUID.generate(),
      article_id: Ecto.UUID.generate(),
      revision: 1,
      type: :invite
    }

    operation = Ecto.UUID.generate()

    assert {:ok, :pass} =
             Repo.transaction(fn ->
               assert {:ok, [_]} =
                        Effects.request_notice(
                          request,
                          :created,
                          actor,
                          [recipient.id, recipient.id],
                          operation
                        )

               :pass
             end)

    assert Repo.aggregate(from(event in Event, where: event.operation_ref == ^operation), :count) ==
             1

    event = Repo.one!(from(event in Event, where: event.operation_ref == ^operation))
    assert event.event == "article.co_author_request"
    assert event.resource_type == "article_co_author_request"
    assert event.data["request_id"] == request.id
    assert event.data["recipient_id"] == recipient.id
    assert event.data["request_type"] == "article_co_author"

    assert {:ok, :pass} =
             CMSOutboxArticleCoAuthor.perform(%Oban.Job{args: %{"event_id" => event.id}})

    assert Repo.get!(Event, event.id).status == :done

    notice = Repo.one!(from(notice in Notice, where: notice.request_id == ^request.id))
    assert notice.user_id == recipient.id
    assert notice.request_type == :article_co_author
    assert notice.event_type == :created
    assert notice.type == :invite
    assert notice.title == "Article co-author request"

    assert {:ok, :pass} =
             CMSOutboxArticleCoAuthor.perform(%Oban.Job{args: %{"event_id" => event.id}})

    assert Repo.aggregate(from(notice in Notice, where: notice.request_id == ^request.id), :count) ==
             1
  end
end
