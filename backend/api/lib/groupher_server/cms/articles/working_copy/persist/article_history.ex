defmodule GroupherServer.CMS.Articles.WorkingCopy.Persist.ArticleHistory do
  @moduledoc """
  Persists immutable Article history events inside the command transaction.

      WorkingCopy.History
        -> verify caller transaction and lock Article
        -> link the previous event and assign sequence
        -> insert ArticleEvent
        -> caller commits or rolls back command and history together
  """

  import Ecto.Query

  alias GroupherServer.Repo
  alias GroupherServer.CMS.Model.{Article, ArticleEvent}

  def append_article_event_in_transaction(article_id, attrs)
      when is_binary(article_id) and is_map(attrs) do
    with {:ok, :pass} <- require_transaction(),
         %Article{} <-
           Repo.one(
             from(article in Article, where: article.id == ^article_id, lock: "FOR UPDATE")
           ),
         {:ok, previous_id} <- previous_event(article_id, attrs),
         sequence <- next_sequence(article_id),
         {:ok, event} <-
           %ArticleEvent{}
           |> ArticleEvent.changeset(
             attrs
             |> Map.put(:article_id, article_id)
             |> Map.put(:sequence, sequence)
             |> Map.put(:previous_event_id, previous_id)
           )
           |> Repo.insert() do
      {:ok, event}
    else
      nil -> {:error, :article_not_found}
      {:error, _reason} = error -> error
    end
  end

  defp require_transaction do
    if Repo.in_transaction?(), do: {:ok, :pass}, else: {:error, :transaction_required}
  end

  defp previous_event(_article_id, %{type: :publish}), do: {:ok, nil}

  defp previous_event(article_id, %{working_copy_id: work_id}) when is_binary(work_id) do
    id =
      Repo.one(
        from(event in ArticleEvent,
          where: event.article_id == ^article_id and event.working_copy_id == ^work_id,
          where: event.type != :publish,
          order_by: [desc: event.sequence],
          limit: 1,
          select: event.id
        )
      )

    {:ok, id}
  end

  defp previous_event(_article_id, _attrs), do: {:error, :invalid_history_event}

  defp next_sequence(article_id) do
    (Repo.one(
       from(event in ArticleEvent,
         where: event.article_id == ^article_id,
         select: max(event.sequence)
       )
     ) || 0) + 1
  end
end
