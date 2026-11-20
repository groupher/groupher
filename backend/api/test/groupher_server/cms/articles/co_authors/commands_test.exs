defmodule GroupherServer.Test.CMS.Articles.CoAuthors.CommandsTest do
  use GroupherServer.TestMate, async: false
  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.CoAuthors.Commands.{CreateRequest, DecideRequest}
  alias CMS.Model.{Article, ArticleCoAuthor, ArticleCoAuthorEvent, ArticleCoAuthorRequest, Author}
  alias CMS.Outbox.Event
  alias GroupherServer.Jobs.CMSOutboxArticleCoAuthor
  alias GroupherServer.Messaging.Model.Notice

  test "invite acceptance creates the member and delivers both durable notices" do
    {_community, public, _article, owner} = mock_article(:post)
    article = Repo.get!(Article, public.id) |> Repo.preload(:author)
    {:ok, subject} = db_insert(:user)
    permissions = %{"article.read_draft" => true, "article.update" => true}

    command_id = Ecto.UUID.generate()

    assert {:ok, %ArticleCoAuthorRequest{} = request} =
             CreateRequest.execute(article, subject, :invite, permissions, owner, command_id)

    assert request.status == :pending
    assert request.type == :invite
    assert request.proposed_permissions == permissions

    assert {:ok, replayed} =
             CreateRequest.execute(article, subject, :invite, permissions, owner, command_id)

    assert replayed.id == request.id

    assert Repo.aggregate(from(event in Event, where: event.resource_id == ^request.id), :count) ==
             1

    assert {:ok, {%ArticleCoAuthorRequest{} = decided, %ArticleCoAuthor{}}} =
             DecideRequest.execute(
               article,
               request.id,
               request.revision,
               :accept,
               permissions,
               subject,
               Ecto.UUID.generate()
             )

    assert decided.status == :decided
    assert decided.decision == :accept
    assert decided.revision == request.revision + 1

    subject_author = Repo.get_by!(Author, user_id: subject.id)
    member = Repo.get_by!(ArticleCoAuthor, article_id: article.id, author_id: subject_author.id)
    assert member.permissions == permissions

    assert Repo.aggregate(
             from(event in ArticleCoAuthorEvent,
               where: event.article_id == ^article.id and event.subject_user_id == ^subject.id
             ),
             :count
           ) == 3

    events =
      Repo.all(
        from(event in Event,
          where: event.resource_id == ^request.id,
          order_by: event.event
        )
      )

    assert length(events) == 2

    for event <- events do
      assert {:ok, :pass} =
               CMSOutboxArticleCoAuthor.perform(%Oban.Job{args: %{"event_id" => event.id}})
    end

    notices =
      Repo.all(
        from(notice in Notice,
          where: notice.request_id == ^request.id,
          order_by: notice.event_type
        )
      )

    assert Enum.map(notices, & &1.event_type) == [:created, :decided]
    assert Enum.sort(Enum.map(notices, & &1.user_id)) == Enum.sort([owner.id, subject.id])
  end
end
