defmodule GroupherServer.Test.CMS.Interactions.CommentOutboxContext do
  use GroupherServer.TestMate

  alias CMS.Model.{ArticleBinding, CommunitySubscriber}
  alias CMS.Outbox.Event
  alias CMS.Outbox.Workflow.Interaction

  setup do
    {source, post, _, author} = mock_article(:post)
    {:ok, mirror} = db_insert(:community)
    {:ok, actor} = db_insert(:user)

    Repo.insert!(
      ArticleBinding.changeset(%ArticleBinding{}, %{
        article_id: post.id,
        community_id: mirror.id,
        inner_id: 9001
      })
    )

    {:ok, original} =
      CMS.Comments.create_comment(
        source,
        :post,
        article_inner_id(post, source),
        mock_comment(),
        author,
        Ecto.UUID.generate()
      )

    {:ok, comment} =
      FrontDesk.comment(%{
        article: %{community: mirror.slug, thread: :post, inner_id: 9001},
        inner_id: original.inner_id
      })

    {:ok, ~m(source mirror actor comment)a}
  end

  for reaction <- [:upvote, :emotion] do
    @reaction reaction
    test "#{reaction} freezes Y context and delivery never subscribes to X", context do
      ~m(source mirror actor comment)a = context
      command_id = Ecto.UUID.generate()
      assert {:ok, _} = react(@reaction, comment, actor, command_id)
      event = Repo.get_by!(Event, command_id: command_id)
      assert event.data["community_id"] == mirror.id
      job = %Oban.Job{args: %{"event_id" => event.id}, attempt: 1, max_attempts: 8}
      assert {:ok, :pass} = Interaction.perform(job)
      assert {:ok, :pass} = Interaction.perform(job)
      assert Repo.get!(Event, event.id).status == :done
      assert Repo.get_by(CommunitySubscriber, community_id: mirror.id, user_id: actor.id)
      refute Repo.get_by(CommunitySubscriber, community_id: source.id, user_id: actor.id)
    end
  end

  test "a removed request Community does not redirect a delayed reaction", context do
    ~m(source mirror actor comment)a = context
    command_id = Ecto.UUID.generate()
    assert {:ok, _} = react(:emotion, comment, actor, command_id)
    event = Repo.get_by!(Event, command_id: command_id)

    Repo.delete_all(
      from(c in GroupherServer.ReviewBot.Model.ReviewBotConfig,
        where: c.community_id == ^mirror.id
      )
    )

    Repo.delete!(mirror)

    assert {:ok, :pass} =
             Interaction.perform(%Oban.Job{
               args: %{"event_id" => event.id},
               attempt: 1,
               max_attempts: 8
             })

    assert Repo.get!(Event, event.id).status == :done
    refute Repo.get_by(CommunitySubscriber, community_id: source.id, user_id: actor.id)
  end

  test "incomplete old intents deliver without guessing a subscription Community", context do
    ~m(source mirror actor comment)a = context

    {:ok, event} =
      CMS.Outbox.send(%{
        event: "interaction.upvote_changed",
        worker: GroupherServer.Jobs.CMSOutboxInteraction,
        resource_type: "comment",
        resource_id: comment.id,
        command_id: Ecto.UUID.generate(),
        data: %{actor_id: actor.id, operation: "add"}
      })

    job = %Oban.Job{args: %{"event_id" => event.id}, attempt: 1, max_attempts: 8}
    assert {:ok, :pass} = Interaction.perform(job)
    assert {:ok, :pass} = Interaction.perform(job)
    assert Repo.get!(Event, event.id).status == :done

    for community <- [source, mirror],
        do:
          refute(Repo.get_by(CommunitySubscriber, community_id: community.id, user_id: actor.id))
  end

  defp react(:upvote, comment, actor, id), do: CMS.Interactions.upvote(comment, actor, id)

  defp react(:emotion, comment, actor, id),
    do: CMS.Interactions.emotion(comment, :heart, actor, id)
end
