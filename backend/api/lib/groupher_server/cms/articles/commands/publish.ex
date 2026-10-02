defmodule GroupherServer.CMS.Articles.Commands.Publish do
  @moduledoc """
  Runs ordinary Article publication through the idempotent command boundary.

      Article + command id
        -> CMS.Command receipt
        -> Articles.publish without a second receipt
        -> stable publish result or canonical recovery result
  """

  alias GroupherServer.CMS
  alias GroupherServer.Accounts.Model.User
  alias CMS.Command
  alias CMS.Articles.Reader
  alias CMS.Model.{Article, ArticlePublic, ArticleRevision, Community}

  @doc "Publishes one ordinary Article Draft with retry-safe command recovery."
  @spec publish(Article.t(), User.t(), keyword()) :: {:ok, map()} | {:error, term()}
  def publish(%Article{} = article, %User{} = user, opts) do
    with {:ok, %Community{} = community} <-
           Reader.community(article.community_id) do
      command = %Command{
        actor: user,
        command_id: Keyword.get(opts, :command_id),
        operation: :article_publish,
        target: article,
        params: opts |> Keyword.delete(:command_id) |> Map.new()
      }

      Command.execute(command,
        action: &publish_action/1,
        result: &recover(&1, community)
      )
    else
      {:error, _reason} = error -> error
    end
  end

  def publish(_article, _actor, _opts), do: {:error, :invalid_publish_actor}

  defp publish_action(%{
         actor: user,
         target: %Article{id: article_id},
         params: params,
         command_id: command_id
       }) do
    publish_opts =
      params
      |> Map.to_list()
      |> Keyword.put(:skip_effects, true)
      |> Keyword.put(:outbox_command_id, command_id)

    case CMS.Articles.publish(article_id, user, publish_opts) do
      {:ok, publish_result} ->
        {:ok, publish_result, publish_metadata(article_id, publish_result)}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp publish_metadata(article_id, publish_result) do
    %{
      result_key: article_id,
      result_payload: %{
        "first_publish?" => Map.get(publish_result, :first_publish?, false),
        "changed_fields" => Enum.map(Map.get(publish_result, :changed_fields, []), &to_string/1),
        "published_by_id" => Map.get(publish_result, :published_by_id)
      }
    }
  end

  defp recover(receipt, community) do
    with article_id when is_binary(article_id) <- receipt.result_key,
         {:ok, %Article{} = article} <- Reader.article(article_id),
         {:ok, %ArticlePublic{} = public} <- Reader.public(article.id),
         {:ok, %ArticleRevision{} = revision} <- Reader.revision(public.revision_id) do
      {:ok,
       %{
         article: article,
         public: public,
         revision: revision,
         first_publish?: payload_value(receipt.result_payload, "first_publish?", false),
         changed_fields:
           receipt.result_payload
           |> payload_value("changed_fields", [])
           |> decode_changed_fields(),
         published_by_id:
           payload_value(receipt.result_payload, "published_by_id", public.published_by_id),
         community: community
       }}
    else
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp payload_value(payload, key, default) when is_map(payload),
    do: Map.get(payload, key, Map.get(payload, payload_atom_key(key), default))

  defp payload_value(_payload, _key, default), do: default

  defp payload_atom_key("first_publish?"), do: :first_publish?
  defp payload_atom_key("changed_fields"), do: :changed_fields
  defp payload_atom_key("published_by_id"), do: :published_by_id

  defp decode_changed_fields(fields) when is_list(fields) do
    Enum.map(fields, fn
      "title" -> :title
      "body_hash" -> :body_hash
      "cover_edit" -> :cover_edit
      value -> value
    end)
  end

  defp decode_changed_fields(_fields), do: []
end
