defmodule GroupherServer.Test.CMS.Articles.FirstPublishNotificationTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{CMS, Messaging}
  alias CMS.Model.{Article, GlobalPassport}
  alias CMS.Outbox.Event
  alias GroupherServer.Jobs.CMSOutboxArticle
  alias GroupherServer.Messaging.Model.Notice
  alias GroupherServer.Messaging.Notices.Dedup

  setup do
    start_supervised!({Oban, repo: Repo, testing: :manual, queues: false, plugins: false})
    {community, view, _, actor} = mock_article(:post)
    Repo.insert!(GlobalPassport.changeset(%GlobalPassport{}, %{user_id: actor.id, is_root: true}))

    article = Repo.get!(Article, view.id)

    event =
      Repo.one!(
        from(row in Event,
          where:
            row.resource_id == ^article.id and
              row.event == "article.first_published_notification"
        )
      )

    %{community: community, article: article, actor: actor, event: event}
  end

  test "actual publication notice survives delivery before outbox completion and root retry", f do
    recipients = f.event.data["notify_user_ids"]
    assert is_list(recipients)
    assert f.event.data["author"]["id"] == author_user_id(f.article.author_id)
    assert recipients != []

    assert {:error, _reason} =
             CMS.Outbox.execute(
               f.event.id,
               fn leased_event ->
                 assert {:ok, %{outcome: :delivered}} =
                          CMS.Articles.Effects.Publish.deliver_first_publish_notification(
                            leased_event
                          )

                 {:error, :interrupted_before_outbox_completion}
               end,
               on_error: :fail
             )

    assert Repo.get!(Event, f.event.id).status == :failed
    assert_notice_facts(f.event, recipients)
    notice_rows = Repo.all(from(notice in Notice, order_by: notice.user_id))
    dedup_rows = Repo.all(Dedup)

    assert {:ok, %{outcome: :requeued}} =
             with_jobs(fn ->
               CMS.retry_outbox_event(f.event.id, 1, f.actor, "resume first publication notice")
             end)

    job = %Oban.Job{args: %{"event_id" => f.event.id}, attempt: 1, max_attempts: 8}
    assert {:ok, :pass} = CMSOutboxArticle.perform(job)
    assert {:ok, :pass} = CMSOutboxArticle.perform(job)

    assert Repo.get!(Event, f.event.id).status == :done
    assert Repo.all(from(notice in Notice, order_by: notice.user_id)) == notice_rows
    assert Repo.all(Dedup) == dedup_rows
    assert_notice_facts(f.event, recipients)
    assert {:ok, 1} = Messaging.unread_count(:notification, hd(recipients))
  end

  defp assert_notice_facts(event, recipients) do
    notices =
      Repo.all(
        from(notice in Notice,
          where: notice.article_id == ^event.resource_id and notice.type == :article_published,
          order_by: notice.user_id
        )
      )

    assert Enum.map(notices, & &1.user_id) == Enum.sort(recipients)

    assert Enum.map(notices, & &1.title) ==
             List.duplicate(event.data["title"], length(recipients))

    assert length(Repo.all(from(row in Dedup, where: not is_nil(row.notice_id)))) ==
             length(recipients)
  end

  defp author_user_id(author_id) do
    Repo.one!(
      from(author in CMS.Model.Author,
        where: author.id == ^author_id,
        select: author.user_id
      )
    )
  end

  defp with_jobs(action) do
    previous = Application.get_env(:groupher_server, :env)
    Application.put_env(:groupher_server, :env, :dev)

    try do
      action.()
    after
      Application.put_env(:groupher_server, :env, previous)
    end
  end
end
