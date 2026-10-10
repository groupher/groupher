defmodule GroupherServer.CMS.Articles.Commands.Publish do
  @moduledoc """
  Publishes an Article revision through the Gate, lifecycle and Receipt boundary.

      Article publish request
        -> Gate/version checks and domain writes
        -> immutable Publish Confirmation
        -> Receipt encode/decode on retry
  """

  alias GroupherServer.{Accounts, CMS}
  alias Helper.T
  alias CMS.{Articles, Command, FrontDesk}
  alias CMS.Articles.Bindings
  alias Accounts.Model.User
  alias Articles.RevisionResult
  alias Articles.Commands.PublishConfirmation
  alias CMS.Model.{Article, Author, Community}
  alias GroupherServer.FrontDesk, as: RootFrontDesk

  @doc "Publishes one ordinary Article Draft, using retry-safe recovery when command_id is present.

  The caller must provide `:community` (or `:community_id`) so the target
  ArticleBinding is always explicit."
  @spec execute(Article.t(), User.t() | Author.t(), keyword()) :: T.domain_res(map())
  def execute(%Article{} = article, actor, opts) do
    case Keyword.get(opts, :command_id) do
      nil -> publish_now(article.id, actor, opts)
      _command_id -> execute_command(article, actor, opts)
    end
  end

  def execute(_article, _actor, _opts) do
    {:error, Articles.ErrorCat.invalid_publish_actor()}
  end

  defp execute_command(%Article{} = article, %User{} = user, opts) do
    case binding_context(article, opts) do
      {:ok, %{community: %Community{} = community}} ->
        command_params =
          opts
          |> Keyword.delete(:command_id)
          |> Keyword.delete(:community)
          |> Map.new()
          |> Map.put(:community_id, community.id)

        command = %Command{
          actor: user,
          command_id: Keyword.get(opts, :command_id),
          operation: :article_publish,
          target: article,
          params: command_params
        }

        with {:ok, %PublishConfirmation{} = confirmation} <-
               Command.execute(command,
                 action: &publish_action/1,
                 confirmation: PublishConfirmation
               ) do
          RevisionResult.build(confirmation, community)
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp execute_command(_article, _actor, _opts) do
    {:error, Articles.ErrorCat.invalid_publish_actor()}
  end

  @spec publish_action(map()) :: Command.action_result(PublishConfirmation.t())
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

    case publish_now(article_id, user, publish_opts) do
      {:ok, publish_result} ->
        {:ok,
         %PublishConfirmation{
           article_id: article_id,
           revision_id: publish_result.public.revision_id,
           publication_version: publish_result.public.publication_version,
           first_publish?: Map.get(publish_result, :first_publish?, false),
           changed_fields: Map.get(publish_result, :changed_fields, []),
           published_by_id: Map.get(publish_result, :published_by_id),
           published_at: publish_result.public.published_at
         }}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp publish_now(article_id, actor, opts) do
    with {:ok, article} <- stable_article(article_id),
         {:ok, author} <- target_author(actor),
         {:ok, result} <- publish_with_gate(article, actor, author, opts),
         {:ok, result} <- maybe_publish_effects(result, opts) do
      {:ok, result}
    end
  end

  defp binding_context(article, opts) do
    case Keyword.get(opts, :community) do
      %Community{} = community ->
        Bindings.get(article, community)

      nil ->
        case Keyword.get(opts, :community_id) do
          community_id when is_integer(community_id) ->
            case GroupherServer.Repo.get(Community, community_id) do
              %Community{} = community -> Bindings.get(article, community)
              _ -> {:error, :article_binding_not_found}
            end

          _ ->
            Bindings.get(article, Map.get(article, :community))
        end

      _ ->
        {:error, :article_binding_context_required}
    end
  end

  defp publish_with_gate(article, actor, author, opts) do
    case binding_context(article, opts) do
      {:ok, %{community: %Community{} = community}} ->
        CMS.Gate.with_community_check(
          actor_user(actor),
          :publish,
          community,
          article,
          fn canonical -> Articles.Writer.publish(canonical, author, actor, opts) end
        )

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp maybe_publish_effects(result, _opts), do: {:ok, result}

  defp target_author(%Author{} = author), do: {:ok, author}
  defp target_author(%User{} = user), do: Articles.Writer.ensure_author_exists(user)
  defp target_author(_actor), do: {:error, :invalid_actor}

  defp actor_user(%User{} = user), do: user
  defp actor_user(%Author{user: %User{} = user}), do: user

  defp actor_user(%Author{user_id: user_id}) do
    case RootFrontDesk.fresh_user(user_id) do
      {:ok, user} -> user
      _ -> nil
    end
  end

  defp stable_article(article_id) do
    case FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{} = article} -> {:ok, article}
      {:error, _} -> {:error, :article_not_found}
    end
  end
end
