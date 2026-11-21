defmodule GroupherServer.CMS.Articles.Commands.CommunityTrashSupport do
  @moduledoc """
  Records Community-only Activity and durable invalidation for one Binding change.

      changed Binding Trash -> Activity + local Outbox -> Receipt confirmation
  """
  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.Effects
  alias CMS.Articles.Commands.CommunityTrashConfirmation, as: Confirmation

  def load_article(id) do
    with {:ok, id} <- Ecto.UUID.cast(id),
         %CMS.Model.Article{thread: thread} = article <- Repo.get(CMS.Model.Article, id),
         true <- thread in [:post, :blog, :changelog] do
      {:ok, article}
    else
      _ -> {:error, CMS.Gate.ErrorCat.resource_not_found()}
    end
  end

  def effects(%{changed?: false}, _article, _community, _actor, _action, _operation_ref) do
    {:ok, :pass}
  end

  def effects(%{binding: binding}, article, community, actor, action, operation_ref) do
    resource = Map.put(article, :community, community)

    with {:ok, _} <-
           Effects.activity(resource, action,
             actor: actor,
             source: :api,
             operation_ref: operation_ref,
             payload: %{operation_scope: "community", effect: "effective"}
           ),
         {:ok, _} <-
           Effects.visibility_changed(binding, community, operation_ref),
         {:ok, _} <- CMS.Communities.update_count_field(community, article.thread) do
      {:ok, :pass}
    end
  end

  def confirmation(%{row: row}, article, command_id, action) do
    %Confirmation{
      data: %{
        "action" => Atom.to_string(action),
        "id" => row.id,
        "article_id" => row.article_id,
        "community_id" => row.community_id,
        "binding_id" => row.binding_id,
        "thread" => Atom.to_string(article.thread),
        "hidden_at" => DateTime.to_iso8601(row.hidden_at),
        "command_id" => command_id
      }
    }
  end

  def present(%Confirmation{data: data}) do
    with {:ok, hidden_at, 0} <- DateTime.from_iso8601(data["hidden_at"]),
         {:ok, thread} <- thread(data["thread"]),
         {:ok, action} <- action(data["action"]) do
      {:ok,
       %{
         id: data["id"],
         article_id: data["article_id"],
         community_id: data["community_id"],
         binding_id: data["binding_id"],
         thread: thread,
         status: :effective,
         public_visible: action == :restore,
         record_revision: "1",
         created_at: hidden_at,
         hidden_at: hidden_at,
         command_id: data["command_id"]
       }}
    else
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp thread("post"), do: {:ok, :post}
  defp thread("blog"), do: {:ok, :blog}
  defp thread("changelog"), do: {:ok, :changelog}
  defp thread(_), do: {:error, :unsupported_thread}

  defp action("hide"), do: {:ok, :hide}
  defp action("restore"), do: {:ok, :restore}
  defp action(_), do: {:error, :unsupported_action}
end
