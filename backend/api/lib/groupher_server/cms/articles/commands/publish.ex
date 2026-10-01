defmodule GroupherServer.CMS.Articles.Commands.Publish do
  @moduledoc """
  Runs ordinary Article publication through the idempotent command boundary.

      Article + command id
        -> CMS.Command receipt
        -> Articles.publish without a second receipt
        -> stable publish result or canonical recovery result
  """

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Command
  alias CMS.Articles.Publish.Effects
  alias CMS.Model.{Article, ArticlePublic, ArticleRevision, Community}

  @doc "Publishes one ordinary Article Draft with retry-safe command recovery."
  @spec publish(Ecto.UUID.t(), User.t(), keyword()) :: {:ok, map()} | {:error, term()}
  def publish(article_id, %User{} = user, opts) when is_binary(article_id) do
    with %Article{} = article <- Repo.get(Article, article_id),
         %Community{} = community <- Repo.get(Community, article.community_id),
         {:ok, command_id} <- Command.resolve_command_id(Keyword.get(opts, :command_id)) do
      command_opts = Keyword.delete(opts, :command_id)

      Command.update_user(user, command_id,
        command: :article_publish,
        resource: article,
        input: Map.new(command_opts),
        recovery: fn _receipt -> recover(article_id, community) end,
        after_commit: fn result ->
          _ = Effects.run(result)
          :ok
        end
      )
      |> Command.run(fn %{resource: %Article{id: id}, input: input} ->
        CMS.Articles.publish(id, user, Map.to_list(input) |> Keyword.put(:skip_effects, true))
        |> case do
          {:ok, result} -> {:ok, result, %{result_key: id}}
          {:error, reason} -> {:error, reason}
        end
      end)
    else
      nil -> {:error, CMS.Articles.ErrorCat.article_not_found("article not found")}
      {:error, _reason} = error -> error
    end
  end

  def publish(_article_id, _actor, _opts), do: {:error, :invalid_publish_actor}

  defp recover(article_id, community) do
    with %Article{} = article <- Repo.get(Article, article_id),
         %ArticlePublic{} = public <- Repo.get(ArticlePublic, article.id),
         %ArticleRevision{} = revision <- Repo.get(ArticleRevision, public.revision_id) do
      {:ok,
       %{
         article: article,
         public: public,
         revision: revision,
         first_publish?: false,
         changed_fields: [],
         published_by_id: public.published_by_id,
         community: community
       }}
    else
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end
end
