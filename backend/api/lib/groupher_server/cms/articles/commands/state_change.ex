defmodule GroupherServer.CMS.Articles.Commands.StateChange do
  @moduledoc """
  Owns Gate admission and aggregate state changes for ordinary Articles.

      state command -> canonical Article -> Gate -> aggregate transition
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.States
  alias CMS.Docs.Store, as: DocStore
  alias CMS.FrontDesk
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias CMS.Model.{Article, Community, DocBranch}
  alias GroupherServer.Accounts.Model.User

  @spec execute(atom(), Ecto.UUID.t(), User.t(), keyword()) :: {:ok, term()} | {:error, term()}
  def execute(action, article_id, %User{} = actor, opts \\ [])
      when action in [:sink, :undo_sink, :set_category, :set_status] do
    with {:ok, %Article{} = article} <- load_article(article_id),
         {:ok, result} <- admit_and_change(action, article, actor, opts) do
      {:ok, result}
    end
  end

  @spec set_category(Ecto.UUID.t(), atom() | nil, User.t(), Community.t()) ::
          {:ok, Article.t()} | {:error, term()}
  def set_category(article_id, category, %User{} = actor, %Community{} = community) do
    with {:ok, %Article{} = article} <- load_article(article_id),
         {:ok, canonical} <-
           CMS.Gate.Access.with_community_check(
             actor,
             :set_category,
             community,
             article,
             fn canonical ->
               States.set_cat(canonical, category)
             end
           ) do
      {:ok, canonical}
    end
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
    with {:ok, %Article{} = article} <- FrontDesk.article(article_id, mode: :internal) do
      set_status_in_community(article, status, actor, community)
    else
      {:error, _reason} -> {:error, GateErrorCat.resource_not_found()}
    end
  end

  @spec update_active_timestamp(atom(), Article.t()) :: {:ok, Article.t()} | {:error, term()}
  def update_active_timestamp(thread, %Article{} = article),
    do: States.update_active_timestamp(thread, article)

  defp admit_and_change(:set_category, article, actor, opts) do
    with {:ok, community} <- resolve_community(opts, article) do
      CMS.Gate.Access.with_community_check(
        actor,
        :set_category,
        community,
        article,
        &States.set_cat(&1, nil)
      )
    end
  end

  defp admit_and_change(action, %Article{thread: :doc} = article, actor, opts)
       when action in [:sink, :undo_sink] do
    with {:ok, community} <- resolve_community(opts, article) do
      branch_id = Keyword.get(opts, :branch_id) || main_branch_id(community.id)

      CMS.Gate.Access.with_branch_check(
        actor,
        action,
        community,
        article,
        branch_id,
        fn canonical ->
          apply(States, action, [canonical, [branch_id: branch_id]])
        end
      )
    end
  end

  defp admit_and_change(action, %Article{} = article, actor, opts)
       when action in [:sink, :undo_sink] do
    with {:ok, community} <- resolve_community(opts, article) do
      CMS.Gate.Access.with_community_check(actor, action, community, article, fn canonical ->
        apply(States, action, [canonical, opts])
      end)
    end
  end

  defp resolve_community(opts, article) do
    case Keyword.get(opts, :community) do
      %Community{} = community ->
        {:ok, community}

      _ ->
        case Keyword.get(opts, :community_id) do
          community_id when is_integer(community_id) ->
            case Repo.get(Community, community_id) do
              %Community{} = community -> {:ok, community}
              _ -> {:error, :article_binding_not_found}
            end

          _ ->
            resolve_branch_community(opts, article)
        end
    end
  end

  defp resolve_branch_community(opts, _article) do
    case Keyword.get(opts, :branch_id) do
      branch_id when is_integer(branch_id) ->
        with %DocBranch{community_id: community_id} <- Repo.get(DocBranch, branch_id),
             %Community{} = community <- Repo.get(Community, community_id) do
          {:ok, community}
        else
          _ -> {:error, :article_binding_not_found}
        end

      _ ->
        {:error, :article_binding_context_required}
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
