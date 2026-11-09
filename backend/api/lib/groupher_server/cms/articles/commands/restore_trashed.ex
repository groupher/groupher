defmodule GroupherServer.CMS.Articles.Commands.RestoreTrashed do
  @moduledoc """
  Restores one Article Trash membership through the optional command receipt boundary.

      CMS.Articles.restore_trashed
        -> RestoreTrashed.execute
        -> CMS.Command when command_id exists -> Articles.Trash aggregate
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Articles.ErrorCat, as: ArticlesErrorCat
  alias CMS.Articles.Trash, as: TrashAgg
  alias CMS.Docs.Trash, as: DocTrash
  alias CMS.{FrontDesk, Articles.Bindings}
  alias CMS.Model.{Article, TrashedArticle, TrashedDocArticle}
  alias CMS.Articles.Commands.TrashRestoreConfirmation, as: Confirmation

  @pipeline operation: :article_restore,
            confirmation: Confirmation,
            target: :command_target,
            params: :command_params
  receipt_pipeline run_receipt(
                     item_or_id,
                     actor,
                     opts,
                     command_id,
                     command_target,
                     command_params
                   ) do
    gate(fn _target ->
      with {:ok, %{article: article, community: community} = loaded} <-
             load_restore(item_or_id, opts),
           {:ok, canonical} <-
             CMS.Gate.check_in_transaction(actor, :restore, article, community) do
        {:ok, Map.put(loaded, :article, canonical)}
      end
    end)

    change(fn %{item: item, article: article} ->
      TrashAgg.restore_loaded(item, article, actor, opts)
    end)

    confirm(fn article ->
      {:ok,
       %Confirmation{
         data: %{
           "article_id" => article.id,
           "community_id" => article.community.id,
           "command_id" => to_string(command_id)
         }
       }}
    end)

    present(fn confirmation -> present_confirmation(confirmation) end)
  end

  @pipeline operation: :article_restore_write, target: :item_or_id, params: :opts
  direct_pipeline run_direct(item_or_id, actor, opts) do
    gate(fn _target ->
      with {:ok, loaded} <- load_restore_write(item_or_id, opts) do
        authorize_restore(loaded, actor)
      end
    end)

    change(fn loaded -> restore_loaded(loaded, actor, opts) end)
  end

  @spec execute(
          Ecto.UUID.t() | TrashedArticle.t() | TrashedDocArticle.t(),
          User.t() | nil,
          keyword()
        ) :: {:ok, term()} | {:error, term()}
  def execute(item_or_id, %User{} = actor, opts) do
    with {:ok, community_id} <- command_community_id(opts) do
      run_receipt(
        item_or_id,
        actor,
        opts,
        Keyword.get(opts, :command_id),
        {:article_trash, community_id},
        %{item_id: item_id(item_or_id), opts: canonical_opts(opts)}
      )
    end
  end

  def execute(_item_or_id, _actor, _opts), do: {:error, :invalid_actor}

  @doc false
  def execute_direct(item_or_id, actor, opts), do: run_direct(item_or_id, actor, opts)

  defp load_restore(item_or_id, opts) do
    with {:ok, community_id} <- command_community_id(opts),
         {:ok, %TrashedArticle{} = item} <- resolve_item(item_or_id, opts),
         %Article{} = article <- GroupherServer.Repo.get(Article, item.article_id),
         {:ok, community} <- FrontDesk.community(community_id, mode: :internal) do
      {:ok, %{item: item, article: article, community: community}}
    else
      nil -> {:error, ArticlesErrorCat.article_not_found("article not found")}
      {:error, reason} -> {:error, reason}
    end
  end

  defp load_restore_write(item_or_id, opts) do
    case resolve_item(item_or_id, opts) do
      {:ok, %TrashedArticle{} = item} ->
        with %Article{} = article <- GroupherServer.Repo.get(Article, item.article_id),
             {:ok, community} <- FrontDesk.community(item.community_id, mode: :internal) do
          {:ok, %{item: item, article: article, community: community}}
        else
          nil -> {:error, ArticlesErrorCat.article_not_found("article not found")}
          {:error, reason} -> {:error, reason}
        end

      {:ok, %TrashedDocArticle{} = item} ->
        DocTrash.load_context(item)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp authorize_restore(
         %{article: article, community: community, branch: branch} = loaded,
         actor
       ) do
    with {:ok, canonical} <-
           CMS.Gate.check_in_transaction(actor, :restore, article, community, branch.id) do
      {:ok, Map.put(loaded, :article, canonical)}
    end
  end

  defp authorize_restore(%{article: article, community: community} = loaded, actor) do
    with {:ok, canonical} <-
           CMS.Gate.check_in_transaction(actor, :restore, article, community) do
      {:ok, Map.put(loaded, :article, canonical)}
    end
  end

  defp restore_loaded(
         %{item: %TrashedDocArticle{} = item, article: article, branch: branch},
         actor,
         opts
       ) do
    DocTrash.restore_loaded(item, article, branch, actor, opts)
  end

  defp restore_loaded(%{item: item, article: article}, actor, opts) do
    TrashAgg.restore_loaded(item, article, actor, opts)
  end

  defp resolve_item(%TrashedArticle{} = item, opts) do
    case scope(opts) do
      :unscoped -> {:ok, item}
      {:community, community_id} -> ensure_scope(item, community_id, nil)
      {:ok, community_id, thread} -> ensure_scope(item, community_id, thread)
      {:error, _reason} = error -> error
    end
  end

  defp resolve_item(item_id, opts) do
    case scope(opts) do
      :unscoped ->
        TrashAgg.get(item_id)

      {:community, community_id} ->
        with {:ok, item} <- TrashAgg.get(item_id) do
          ensure_scope(item, community_id, nil)
        end

      {:ok, community_id, thread} ->
        TrashAgg.get_in_scope(item_id, community_id, thread)

      {:error, _reason} = error ->
        error
    end
  end

  defp present_confirmation(%Confirmation{
         data: %{
           "article_id" => article_id,
           "community_id" => community_id,
           "command_id" => command_id
         }
       }) do
    case {FrontDesk.article(article_id, mode: :internal),
          FrontDesk.community(community_id, mode: :internal)} do
      {{:ok, %Article{} = article}, {:ok, community}} ->
        with {:ok, %{inner_id: inner_id}} <- Bindings.get(article, community) do
          {:ok, article |> Map.put(:inner_id, inner_id) |> Map.put(:command_id, command_id)}
        end

      _ ->
        {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp present_confirmation(_confirmation) do
    {:error, CMS.ErrorCat.command_result_unavailable()}
  end

  defp canonical_opts(opts), do: opts |> Keyword.delete(:command_id) |> Map.new()
  defp item_id(%TrashedArticle{hash_id: hash_id}), do: hash_id
  defp item_id(item_id), do: item_id

  defp command_community_id(opts) do
    case Keyword.get(opts, :community_id) do
      community_id when is_integer(community_id) -> {:ok, community_id}
      _ -> {:error, :community_id_required}
    end
  end

  defp scope(opts) do
    case {Keyword.get(opts, :community_id), Keyword.get(opts, :thread)} do
      {nil, nil} ->
        :unscoped

      {community_id, nil} when is_integer(community_id) ->
        {:community, community_id}

      {community_id, thread} when is_integer(community_id) and is_atom(thread) ->
        {:ok, community_id, thread}

      _ ->
        {:error, ArticlesErrorCat.not_exist("TrashedArticle")}
    end
  end

  defp ensure_scope(item, community_id, thread) do
    if item.community_id == community_id and (is_nil(thread) or item.thread == thread) do
      {:ok, item}
    else
      {:error, ArticlesErrorCat.not_exist("TrashedArticle")}
    end
  end
end
