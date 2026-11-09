defmodule GroupherServer.CMS.ArtimentMentions.Effects.Notifications do
  @moduledoc """
  Delivers newly introduced explicit User mentions from current relationships.

      published revision intent -> current revision + public eligibility -> mailbox rows

  Recipient IDs frozen by capture are checked against current edges again;
  source content is never reparsed.
  Mailbox rows and the consumed-recipient marker commit together, so newer
  versions can carry undelivered intentions without repeating completed ones.
  """
  import Ecto.Query
  alias GroupherServer.{Accounts, CMS, Messaging, Repo}
  alias CMS.ArtimentMentions.Query
  alias CMS.Model.Mentions.{Edge, Endpoint}
  alias CMS.Model.Author
  alias CMS.Outbox.Event
  alias Accounts.Model.User
  @restricted_retention_seconds 7 * 24 * 60 * 60

  def deliver(_source_id, _revision_identity, _community_id, [], _event_id) do
    {:ok, :no_new_mentions}
  end

  def deliver(source_id, revision_identity, community_id, recipient_ids, event_id)
      when is_binary(revision_identity) and is_integer(community_id) and is_list(recipient_ids) do
    case Repo.transaction(fn ->
           case deliver_current(
                  source_id,
                  revision_identity,
                  community_id,
                  recipient_ids,
                  event_id
                ) do
             {:ok, result} -> result
             {:error, reason} -> Repo.rollback(reason)
           end
         end) do
      {:ok, {:delivered, users}} ->
        _ = Accounts.mailbox_invalidate_users(users)
        {:ok, :pass}

      {:ok, {:skipped, reason}} ->
        {:ok, reason}

      {:error, :content_not_public} ->
        defer_or_expire(event_id)

      {:error, reason} ->
        {:error, reason}
    end
  end

  def deliver(_, _, _, _, _), do: {:error, :invalid_mention_notification}

  defp defer_or_expire(event_id) do
    case Repo.get(Event, event_id) do
      %Event{inserted_at: inserted_at} when not is_nil(inserted_at) ->
        remaining =
          @restricted_retention_seconds - DateTime.diff(DateTime.utc_now(), inserted_at)

        if remaining > 0 do
          {:defer, min(3_600, remaining)}
        else
          {:ok, :expired_restricted_source}
        end

      _ ->
        {:error, :invalid_mention_notification}
    end
  end

  defp deliver_current(source_id, revision_identity, community_id, recipient_ids, event_id) do
    with %Endpoint{deleted_at: nil} = endpoint <-
           Repo.get(Endpoint, source_id, lock: "FOR UPDATE"),
         {:ok, selected} <- Query.selected_source(endpoint),
         :current <- revision_match(selected, revision_identity),
         :visible <- source_visibility(endpoint, community_id),
         %User{} = author <- author(selected) do
      actual_ids =
        from(edge in Edge,
          where: edge.source_endpoint_id == ^source_id and edge.target_type == :user,
          select: edge.target_user_id,
          distinct: true
        )
        |> Repo.all()

      recipients =
        from(user in User, where: user.id in ^recipient_ids and user.id in ^actual_ids)
        |> Repo.all()
        |> Enum.reject(&(&1.id == author.id))

      now = DateTime.utc_now(:second)

      rows =
        Enum.map(recipients, fn user ->
          %{
            from_user_id: author.id,
            to_user_id: user.id,
            article_id: selected.article_id,
            comment_id: endpoint.comment_id,
            branch_id: delivery_branch(endpoint, selected),
            thread: selected.thread,
            title: selected.title,
            read: false,
            block_linker: [],
            inserted_at: now,
            updated_at: now
          }
        end)

      with {:ok, users} <- Messaging.record_mention_in_transaction(selected.content, rows, author),
           %Event{resource_id: ^source_id} = event <- Repo.get(Event, event_id),
           {:ok, _} <-
             event
             |> Event.changeset(%{data: Map.put(event.data, "consumed_user_ids", recipient_ids)})
             |> Repo.update() do
        {:ok, {:delivered, users}}
      else
        {:error, reason} -> {:error, reason}
        _ -> {:error, :invalid_mention_notification}
      end
    else
      {:error, :mention_current_source_missing} -> {:ok, {:skipped, :stale_or_removed_source}}
      {:error, reason} -> {:error, reason}
      :stale -> {:ok, {:skipped, :stale_or_removed_source}}
      :unavailable -> {:error, :content_not_public}
      _ -> {:ok, {:skipped, :stale_or_removed_source}}
    end
  end

  defp author(%{author_user_id: id}), do: Repo.get(User, id)

  defp author(%{author_id: id}) do
    case Repo.get(Author, id) do
      %Author{user_id: user_id} -> Repo.get(User, user_id)
      _ -> nil
    end
  end

  defp revision_match(%{published_revision_identity: revision_identity}, revision_identity) do
    :current
  end

  defp revision_match(_, _), do: :stale

  defp source_visibility(endpoint, community_id) do
    if Query.source_visible?(endpoint, community_id), do: :visible, else: :unavailable
  end

  defp delivery_branch(%{type: :comment}, _selected), do: nil
  defp delivery_branch(_endpoint, selected), do: selected.branch_id
end
