defmodule GroupherServer.CMS.DocTree.Publish.Queue.Discard do
  @moduledoc """
  Calculates and validates explicit confirmation for discarding Queue-only content.

      locked operation + Queue revision + D / Q / source -> discard confirmation

  The caller must provide the complete canonical operation and every affected
  locked Doc, recheck their revisions, and own the surrounding transaction.
  This module does not authorize, lock, delete, or persist resources.
  """

  alias GroupherServer.CMS
  alias CMS.DocTree.Publish.ContentMerge

  @doc "Checks whether the exact operation has confirmation for all Q-only changes."
  def check(operation, revision, documents, confirmation \\ nil)

  def check(%{"kind" => kind} = operation, revision, documents, confirmation)
      when is_binary(kind) and kind != "" and is_integer(revision) and revision >= 0 and
             is_list(documents) and documents != [] do
    with {:ok, docs} <- normalize_documents(documents),
         {:ok, affected} <- inspect_documents(docs),
         {:ok, proof} <- confirmation_for(operation, revision, affected) do
      decide(affected, proof, confirmation)
    end
  end

  def check(_, _, _, _), do: {:error, :invalid_discard_request}

  defp normalize_documents(documents) do
    Enum.reduce_while(documents, {:ok, [], MapSet.new()}, fn document, {:ok, acc, seen} ->
      with %{
             article_id: article_id,
             default_revision: default_revision,
             source: source,
             queue: queue,
             default: default
           } <- document,
           {:ok, article_id} <- Ecto.UUID.cast(article_id),
           true <- is_integer(default_revision) and default_revision > 0,
           true <- is_map(source) and is_map(queue) and is_map(default),
           false <- MapSet.member?(seen, article_id) do
        item = %{
          article_id: article_id,
          default_revision: default_revision,
          source: source,
          queue: queue,
          default: default
        }

        {:cont, {:ok, [item | acc], MapSet.put(seen, article_id)}}
      else
        _ -> {:halt, {:error, :invalid_discard_request}}
      end
    end)
    |> case do
      {:ok, items, _seen} -> {:ok, Enum.sort_by(items, & &1.article_id)}
      error -> error
    end
  end

  defp inspect_documents(documents) do
    Enum.reduce_while(documents, {:ok, []}, fn document, {:ok, acc} ->
      case ContentMerge.exclusive_changes(document.source, document.queue, document.default) do
        {:ok, fields} ->
          item = %{
            "article_id" => document.article_id,
            "default_revision" => document.default_revision,
            "exclusive_fields" => Enum.map(fields, &Atom.to_string/1)
          }

          {:cont, {:ok, [item | acc]}}

        {:error, _reason} = error ->
          {:halt, error}
      end
    end)
    |> case do
      {:ok, items} -> {:ok, Enum.reverse(items)}
      error -> error
    end
  end

  defp confirmation_for(operation, revision, affected) do
    payload = %{
      "format_version" => 1,
      "operation" => operation,
      "queue_revision" => revision,
      "documents" => affected
    }

    case RFC8785.encode(payload) do
      {:ok, canonical} ->
        hash = :crypto.hash(:sha256, canonical) |> Base.encode16(case: :lower)
        {:ok, %{"format_version" => 1, "hash" => hash}}

      {:error, _reason} ->
        {:error, :invalid_discard_request}
    end
  end

  defp decide(affected, proof, confirmation) do
    required = Enum.filter(affected, &(&1["exclusive_fields"] != []))

    cond do
      not is_nil(confirmation) and confirmation != proof ->
        {:error, :stale_discard_confirmation}

      required != [] and is_nil(confirmation) ->
        {:error, {:discard_confirmation_required, %{documents: required, confirmation: proof}}}

      true ->
        {:ok, %{documents: affected}}
    end
  end
end
