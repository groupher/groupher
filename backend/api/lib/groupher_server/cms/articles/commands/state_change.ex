defmodule GroupherServer.CMS.Articles.Commands.StateChange do
  @moduledoc """
  Owns Gate admission and aggregate state changes for ordinary Articles.

      state command -> canonical Article -> Gate -> aggregate transition
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias Accounts.Model.User
  alias CMS.Articles.States
  alias CMS.Docs.Store, as: DocStore
  alias CMS.FrontDesk
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias CMS.Model.{Article, Community}

  @spec execute(atom(), Ecto.UUID.t(), User.t(), keyword()) :: {:ok, term()} | {:error, term()}
  def execute(action, article_id, %User{} = actor, opts \\ [])
      when action in [:sink, :undo_sink, :set_category, :set_status] do
    case action do
      :sink -> sink_pipeline(article_id, actor, opts)
      :undo_sink -> undo_sink_pipeline(article_id, actor, opts)
      :set_category -> set_category(article_id, nil, actor, Keyword.fetch!(opts, :community))
      :set_status -> {:error, ArticleErrorCat.binding_context_required()}
    end
  end

  @spec set_category(Ecto.UUID.t(), atom() | nil, User.t(), Community.t()) ::
          {:ok, Article.t()} | {:error, term()}
  @pipeline operation: :article_set_category, target: :article_id
  direct_pipeline set_category(article_id, category, actor, community) do
    gate(fn _candidate ->
      with {:ok, article} <- load_article(article_id) do
        CMS.Gate.check_in_transaction(actor, :set_category, article, community)
      end
    end)

    change(fn canonical -> States.set_cat(canonical, category) end)
  end

  @pipeline operation: :article_sink, target: :article_id
  direct_pipeline sink_pipeline(article_id, actor, opts) do
    gate(fn _candidate -> authorize_state_change(:sink, article_id, actor, opts) end)
    change(fn {canonical, change_opts} -> States.sink(canonical, change_opts) end)
  end

  @pipeline operation: :article_undo_sink, target: :article_id
  direct_pipeline undo_sink_pipeline(article_id, actor, opts) do
    gate(fn _candidate -> authorize_state_change(:undo_sink, article_id, actor, opts) end)
    change(fn {canonical, change_opts} -> States.undo_sink(canonical, change_opts) end)
  end

  @spec set_status_in_community(map(), atom() | nil, User.t(), Community.t()) ::
          {:ok, Article.t()} | {:error, term()}
  def set_status_in_community(
        %Article{} = article,
        status,
        %User{} = actor,
        %Community{} = community
      ) do
    CMS.Kanban.set_status(community, article, status, actor)
  end

  def set_status_in_community(
        %{id: article_id},
        status,
        %User{} = actor,
        %Community{} = community
      )
      when is_binary(article_id) do
    case FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{} = article} -> set_status_in_community(article, status, actor, community)
      {:error, _reason} -> {:error, GateErrorCat.resource_not_found()}
    end
  end

  @spec update_active_timestamp(atom(), Article.t()) :: {:ok, Article.t()} | {:error, term()}
  def update_active_timestamp(thread, %Article{} = article) do
    States.update_active_timestamp(thread, article)
  end

  defp authorize_state_change(action, article_id, actor, opts) do
    with {:ok, article} <- load_article(article_id),
         {:ok, community} <- resolve_community(opts, article) do
      authorize_loaded_state_change(action, article, community, actor, opts)
    end
  end

  defp authorize_loaded_state_change(
         action,
         %Article{thread: :doc} = article,
         community,
         actor,
         opts
       ) do
    branch_id = Keyword.get(opts, :branch_id) || main_branch_id(community.id)

    with {:ok, canonical} <-
           CMS.Gate.check_in_transaction(actor, action, article, community, branch_id) do
      {:ok, {canonical, [branch_id: branch_id]}}
    end
  end

  defp authorize_loaded_state_change(action, %Article{} = article, community, actor, opts) do
    with {:ok, canonical} <- CMS.Gate.check_in_transaction(actor, action, article, community) do
      {:ok, {canonical, opts}}
    end
  end

  defp resolve_community(opts, article) do
    case Keyword.get(opts, :community) do
      %Community{} = community ->
        {:ok, community}

      _ ->
        case Keyword.get(opts, :community_id) do
          community_id when is_integer(community_id) ->
            case FrontDesk.community(community_id, mode: :internal) do
              {:ok, %Community{} = community} -> {:ok, community}
              {:error, _reason} -> {:error, CMS.Communities.ErrorCat.not_exist()}
            end

          _ ->
            resolve_branch_community(opts, article)
        end
    end
  end

  defp resolve_branch_community(opts, _article) do
    case Keyword.get(opts, :branch_id) do
      branch_id when is_integer(branch_id) ->
        with {:ok, %{community_id: community_id}} <- CMS.Docs.Store.branch_context(branch_id),
             {:ok, community} <- FrontDesk.community(community_id, mode: :internal) do
          {:ok, community}
        end

      _ ->
        {:error, ArticleErrorCat.binding_context_required()}
    end
  end

  defp load_article(article_id) do
    case FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{} = article} -> {:ok, article}
      {:error, _} -> {:error, GateErrorCat.resource_not_found()}
    end
  end

  defp main_branch_id(community_id) do
    case DocStore.branch(community_id, :main) do
      {:ok, %{id: branch_id}} -> branch_id
      {:error, _} -> nil
    end
  end
end
