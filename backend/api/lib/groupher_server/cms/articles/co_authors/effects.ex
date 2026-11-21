defmodule GroupherServer.CMS.Articles.CoAuthors.Effects do
  @moduledoc """
  Writes durable notification intents for Article co-author requests.

      request command -> Outbox intent -> Messaging Notice after commit
  """

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Model.{ArticleCoAuthorEvent, ArticleCoAuthorRequest}
  alias CMS.Outbox.DedupeKey

  @request_events [:created, :decided, :cancelled, :expired]

  @doc "Enqueues one stable request Notice intent per recipient in the caller transaction."
  def request_notice(
        %ArticleCoAuthorRequest{} = request,
        event,
        actor,
        recipients,
        operation_ref
      )
      when event in @request_events and is_list(recipients) and is_binary(operation_ref) do
    with true <- Repo.in_transaction?(),
         {:ok, actor_data} <- actor_data(actor),
         true <- Enum.all?(recipients, &(is_integer(&1) and &1 > 0)) do
      recipients
      |> Enum.uniq()
      |> Enum.sort()
      |> Enum.reduce_while({:ok, []}, fn recipient, {:ok, sent} ->
        dedupe_key = DedupeKey.encode([request.id, request.revision, event, recipient])

        case CMS.Outbox.send(%{
               event: "article.co_author_request",
               worker: GroupherServer.Jobs.CMSOutboxArticleCoAuthor,
               resource_type: "article_co_author_request",
               resource_id: request.id,
               operation_ref: operation_ref,
               dedupe_key: dedupe_key,
               data: %{
                 article_id: request.article_id,
                 request_id: request.id,
                 request_revision: request.revision,
                 request_type: "article_co_author",
                 request_action: Atom.to_string(request.type),
                 event_type: Atom.to_string(event),
                 recipient_id: recipient,
                 actor: actor_data
               }
             }) do
          {:ok, intent} -> {:cont, {:ok, [intent | sent]}}
          {:error, _} = error -> {:halt, error}
        end
      end)
    else
      false -> {:error, :invalid_article_co_author_effect}
      {:error, _} = error -> error
    end
  end

  def request_notice(_, _, _, _, _), do: {:error, :invalid_article_co_author_effect}

  @doc "Records one immutable authorization event in the caller transaction."
  def record_event(attrs) when is_map(attrs) do
    with true <- Repo.in_transaction?(),
         {:ok, actor_type, actor_id} <- event_actor(Map.get(attrs, :actor)),
         attrs <-
           attrs
           |> Map.drop([:actor])
           |> Map.merge(%{
             actor_type: actor_type,
             actor_id: actor_id,
             occurred_at: Map.get(attrs, :occurred_at, DateTime.utc_now(:second))
           }),
         {:ok, event} <-
           %ArticleCoAuthorEvent{}
           |> ArticleCoAuthorEvent.changeset(attrs)
           |> Repo.insert() do
      {:ok, event}
    else
      false -> {:error, :transaction_required}
      {:error, _} = error -> error
    end
  end

  def record_event(_), do: {:error, :invalid_article_co_author_event}

  defp event_actor(%User{id: id}) when is_integer(id) and id > 0, do: {:ok, :user, id}
  defp event_actor(:system), do: {:ok, :system, nil}
  defp event_actor(_), do: {:error, :invalid_article_co_author_actor}

  defp actor_data(%User{id: id}) when is_integer(id) and id > 0 do
    {:ok, %{type: :user, user_id: id}}
  end

  defp actor_data(:system), do: {:ok, %{type: :system}}
  defp actor_data(_), do: {:error, :invalid_article_co_author_actor}
end
