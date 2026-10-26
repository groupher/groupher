defmodule GroupherServer.CMS.Articles.Commands.Trash do
  @moduledoc """
  Moves one stable Article into Trash through the optional command receipt boundary.

      CMS.Articles.trash
        -> Trash.execute
        -> CMS.Command when command_id exists -> Articles.Trash aggregate
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.CommandPipeline
  alias GroupherServer.{Accounts, CMS}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias Accounts.Model.User
  alias CMS.Articles.Trash, as: TrashAgg
  alias CMS.Articles.{Bindings, Commands.TrashConfirmation}
  alias CMS.Model.{Community, TrashedArticle}
  alias CommandPipeline.{RejectionContext, RejectionData}

  @pipeline operation: :article_trash,
            confirmation: TrashConfirmation,
            target: :article,
            params: :opts
  receipt_pipeline execute_receipt(article, actor, opts, command_id) do
    prepare(fn -> prepare_article(article) end)

    gate(fn candidate ->
      with {:ok, %Community{} = community} <- community_context(candidate, opts) do
        CMS.Gate.check_in_transaction(actor, :delete, candidate, community)
      end
    end)

    change(fn canonical -> TrashAgg.trash_loaded(canonical, actor, opts) end)

    confirm(fn item ->
      {:ok,
       %TrashConfirmation{
         data: %{
           "trash_id" => item.hash_id,
           "article_id" => to_string(item.article_id),
           "command_id" => to_string(command_id)
         }
       }}
    end)

    present(fn confirmation -> present_confirmation(confirmation) end)

    on_rejection(&build_rejection/1)
  end

  @pipeline operation: :article_trash_write, target: :article, params: :opts
  direct_pipeline execute_direct(article, actor, opts) do
    prepare(fn -> prepare_article(article) end)

    gate(fn candidate ->
      with {:ok, %Community{} = community} <- community_context(candidate, opts) do
        CMS.Gate.check_in_transaction(actor, :delete, candidate, community)
      end
    end)

    change(fn canonical -> TrashAgg.trash_loaded(canonical, actor, opts) end)

    on_rejection(&build_rejection/1)
  end

  @pipeline operation: :article_trash_internal,
            access: :internal,
            target: :article,
            params: :opts
  direct_pipeline run_internal(article, opts) do
    prepare(fn -> prepare_article(article) end)

    gate(fn candidate ->
      with {:ok, %Community{} = community} <- community_context(candidate, opts) do
        CMS.Gate.check_in_transaction(:operations, :delete, candidate, community)
      end
    end)

    change(fn canonical -> TrashAgg.trash_loaded(canonical, :operations, opts) end)

    on_rejection(&build_rejection/1)
  end

  @doc "Runs the user Article Trash contract, using Receipt recovery when requested."
  @spec execute(map(), User.t() | nil, keyword()) ::
          {:ok, TrashedArticle.t()} | {:error, term()}
  def execute(article, %User{} = actor, opts) do
    command_id = Keyword.get(opts, :command_id)
    execute_receipt(article, actor, opts, command_id)
  end

  def execute(_article, _actor, _opts), do: {:error, CMS.Gate.ErrorCat.permission_denied()}

  @doc "Runs the internal Article Trash contract with the operations actor."
  @spec execute_internal(map(), keyword()) :: {:ok, TrashedArticle.t()} | {:error, term()}
  def execute_internal(article, opts), do: run_internal(article, opts)

  defp prepare_article(%{thread: :doc}) do
    {:error,
     CMS.Articles.ErrorCat.custom("Doc Trash is owned by the branch-scoped Docs Tree lifecycle")}
  end

  defp prepare_article(article), do: {:ok, article}

  defp present_confirmation(%TrashConfirmation{
         data: %{"trash_id" => trash_id, "command_id" => command_id}
       }) do
    with {:ok, item} <- TrashAgg.get(trash_id) do
      {:ok, Map.put(item, :command_id, command_id)}
    end
  end

  defp present_confirmation(error), do: error

  defp community_context(article, opts) do
    case Keyword.get(opts, :community) do
      %Community{} = community ->
        Bindings.get(article, community) |> normalize_binding()

      nil ->
        if Keyword.has_key?(opts, :community_id) do
          case Keyword.get(opts, :community_id) do
            community_id when is_integer(community_id) ->
              case GroupherServer.Repo.get(Community, community_id) do
                %Community{} = community ->
                  Bindings.get(article, community) |> normalize_binding()

                nil ->
                  {:error, ArticleErrorCat.binding_not_found()}
              end

            _ ->
              {:error, ArticleErrorCat.binding_context_required()}
          end
        else
          Bindings.get(article, Map.get(article, :community)) |> normalize_binding()
        end

      _ ->
        {:error, ArticleErrorCat.binding_context_required()}
    end
  end

  defp normalize_binding({:ok, %{community: %Community{} = community}}), do: {:ok, community}
  defp normalize_binding({:error, reason}), do: {:error, reason}

  defp normalize_binding(_) do
    {:error, ArticleErrorCat.binding_not_found()}
  end

  defp build_rejection(%RejectionContext{
         arguments: %{article: article, opts: opts},
         error: error
       }) do
    %RejectionData{
      resource: article,
      action: :trashed,
      rejection_code: rejection_code(error),
      source: Keyword.get(opts, :source)
    }
  end

  defp rejection_code(%{reason: reason}), do: reason
  defp rejection_code(%{primary: %{reason: reason}}), do: reason
  defp rejection_code(reason) when is_atom(reason), do: reason
  defp rejection_code(_reason), do: :unknown
end
