defmodule GroupherServer.CMS.Articles.Commands.Publish do
  @moduledoc """
  Publishes an Article revision through the Gate, lifecycle and Receipt boundary.

      Article publish request
        -> Gate/version checks and domain writes
        -> immutable Publish Confirmation
        -> Receipt encode/decode on retry
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias Helper.T
  alias CMS.{Articles, FrontDesk}
  alias CMS.Articles.Bindings
  alias Accounts.Model.User
  alias Articles.RevisionResult
  alias Articles.Commands.PublishConfirmation
  alias CMS.Model.{Article, Author, Community}
  alias GroupherServer.FrontDesk, as: RootFrontDesk

  @pipeline operation: :article_publish,
            confirmation: PublishConfirmation,
            target: :article,
            params: :command_params
  receipt_pipeline run_receipt(article, user, opts, command_id, community, command_params) do
    gate(fn _article ->
      with {:ok, stable} <- stable_article(article.id),
           {:ok, author} <- target_author(user),
           {:ok, canonical} <- CMS.Gate.check_in_transaction(user, :publish, stable, community) do
        {:ok, %{article: canonical, author: author}}
      end
    end)

    change(fn %{article: canonical, author: author} ->
      publish_opts =
        command_params
        |> Map.to_list()
        |> Keyword.put(:skip_effects, true)
        |> Keyword.put(:outbox_command_id, command_id)

      Articles.Workflow.publish(canonical, author, user, publish_opts)
    end)

    confirm(fn publish_result ->
      {:ok,
       %PublishConfirmation{
         article_id: article.id,
         revision_id: publish_result.public.revision_id,
         publication_version: publish_result.public.publication_version,
         first_publish?: Map.get(publish_result, :first_publish?, false),
         changed_fields: Map.get(publish_result, :changed_fields, []),
         published_by_id: Map.get(publish_result, :published_by_id),
         published_at: publish_result.public.published_at
       }}
    end)

    present(fn confirmation -> RevisionResult.build(confirmation, community) end)
  end

  @pipeline operation: :article_publish_write, target: :article, params: :opts
  direct_pipeline run_direct(article, actor, opts) do
    gate(fn _article -> load_and_authorize(article, actor, opts) end)

    change(fn %{article: canonical, author: author} ->
      Articles.Workflow.publish(canonical, author, actor, opts)
    end)
  end

  @doc "Publishes one ordinary Article Draft, using retry-safe recovery when command_id is present.

  The caller must provide `:community` (or `:community_id`) so the target
  ArticleBinding is always explicit."
  @spec execute(Article.t(), User.t() | Author.t(), keyword()) :: T.domain_res(map())
  def execute(%Article{} = article, actor, opts), do: execute_command(article, actor, opts)

  def execute(_article, _actor, _opts) do
    {:error, Articles.ErrorCat.invalid_publish_actor()}
  end

  @doc false
  def execute_direct(%Article{} = article, actor, opts) do
    run_direct(article, actor, Keyword.delete(opts, :command_id))
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

        run_receipt(
          article,
          user,
          opts,
          Keyword.fetch!(opts, :command_id),
          community,
          command_params
        )

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp execute_command(_article, _actor, _opts) do
    {:error, Articles.ErrorCat.invalid_publish_actor()}
  end

  @doc "Publishes a newly-created Article after the enclosing create gate admitted the write."
  def publish_after_gate(%Article{} = article, actor, opts) do
    with true <-
           GroupherServer.Repo.in_transaction?() ||
             {:error, CMS.Gate.ErrorCat.gate_transaction_required()},
         {:ok, author} <- target_author(actor) do
      Articles.Workflow.publish(article, author, actor, opts)
    end
  end

  defp binding_context(article, opts) do
    case Keyword.get(opts, :community) do
      %Community{} = community ->
        Bindings.get(article, community)

      nil ->
        case Keyword.get(opts, :community_id) do
          community_id when is_integer(community_id) ->
            case CMS.FrontDesk.community(community_id, mode: :internal) do
              {:ok, %Community{} = community} -> Bindings.get(article, community)
              {:error, _reason} -> {:error, CMS.Communities.ErrorCat.not_exist()}
            end

          _ ->
            Bindings.get(article, Map.get(article, :community))
        end

      _ ->
        {:error, ArticleErrorCat.binding_context_required()}
    end
  end

  defp load_and_authorize(article, actor, opts) do
    case binding_context(article, opts) do
      {:ok, %{community: %Community{} = community}} ->
        with {:ok, stable} <- stable_article(article.id),
             {:ok, author} <- target_author(actor),
             {:ok, canonical} <-
               CMS.Gate.check_in_transaction(actor_user(actor), :publish, stable, community) do
          {:ok, %{article: canonical, author: author}}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp target_author(%Author{} = author), do: {:ok, author}
  defp target_author(%User{} = user), do: Articles.Persist.ensure_author_exists(user)
  defp target_author(_actor), do: {:error, CMS.Gate.ErrorCat.permission_denied()}

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
      {:error, _} -> {:error, Articles.ErrorCat.article_not_found()}
    end
  end
end
