defmodule GroupherServer.CMS.Articles.Commands.DeleteWorkingCopy do
  @moduledoc """
  Discards one editable WorkingCopy while preserving Article, Lifecycle, Public, and Snapshots.

      deleteWorkingCopy -> Gate / Article lock -> deletion eligibility -> dependent rows + WorkingCopy
        -> Receipt confirmation
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  import Ecto.Query

  alias GroupherServer.{CMS, Repo, Accounts}
  alias Accounts.Model.User
  alias CMS.Articles.Commands.DeleteWorkingCopyConfirmation, as: Confirmation
  alias CMS.Articles.WorkingCopy.Access, as: WorkingCopyAccess
  alias CMS.Articles.WorkingCopy.Deleter
  alias CMS.Model.{Article, ArticleWorkingCopy, Community}

  @pipeline operation: :article_delete_working_copy,
            confirmation: Confirmation,
            target: :article,
            params: [:working_copy_id]

  receipt_pipeline run_receipt(article, working_copy_id, community, actor, command_id) do
    gate(fn _article ->
      WorkingCopyAccess.check_in_transaction(actor, :edit, article, community)
    end)

    change(fn canonical_article ->
      with {:ok, :pass} <- WorkingCopyAccess.generic_delete(canonical_article),
           %ArticleWorkingCopy{} = work <- lock_work(canonical_article.id, working_copy_id),
           {:ok, :deleted} <- Deleter.delete_in_transaction(canonical_article, work) do
        {:ok, work.id}
      else
        nil ->
          {:error, :working_copy_not_found}

        {:error, :last_unpublished_work} ->
          {:error, CMS.ErrorCat.last_unpublished_work()}

        {:error, :work_in_use} ->
          {:error, CMS.ErrorCat.work_in_use()}

        {:error, :cover_edit_delete_failed} ->
          {:error, CMS.ErrorCat.cover_edit_delete_failed()}

        {:error, :working_copy_children_delete_failed} ->
          {:error, CMS.ErrorCat.working_copy_children_delete_failed()}

        {:error, _reason} = error ->
          error
      end
    end)

    confirm(fn working_copy_id ->
      {:ok,
       %Confirmation{
         data: %{
           "article_id" => article.id,
           "working_copy_id" => working_copy_id,
           "command_id" => command_id
         }
       }}
    end)

    present(fn confirmation -> present_confirmation(confirmation, article, community, actor) end)
  end

  def execute(%Article{} = article, %Community{} = community, id, %User{} = actor, command_id)
      when is_binary(id) and is_binary(command_id) do
    with {:ok, _binding} <- CMS.Articles.Bindings.get(article, community) do
      article
      |> then(&run_receipt(&1, id, community, actor, command_id))
      |> map_delete_error()
    end
  end

  def execute(_article, _community, _id, _actor, _command_id) do
    {:error, :invalid_working_copy_command}
  end

  defp lock_work(article_id, id) do
    Repo.one(
      from(work in ArticleWorkingCopy,
        where: work.article_id == ^article_id and work.id == ^id,
        lock: "FOR UPDATE"
      )
    )
  end

  defp present_confirmation(
         %Confirmation{data: %{"article_id" => article_id}},
         %Article{id: article_id} = article,
         community,
         actor
       ) do
    case WorkingCopyAccess.access_check(actor, :edit, article, community) do
      {:ok, _article} = result -> result
      {:error, _reason} -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp present_confirmation(_, _, _, _), do: {:error, CMS.ErrorCat.command_result_unavailable()}

  defp map_delete_error({:error, :work_in_use}), do: {:error, CMS.ErrorCat.work_in_use()}

  defp map_delete_error({:error, :cover_edit_delete_failed}) do
    {:error, CMS.ErrorCat.cover_edit_delete_failed()}
  end

  defp map_delete_error({:error, :working_copy_children_delete_failed}) do
    {:error, CMS.ErrorCat.working_copy_children_delete_failed()}
  end

  defp map_delete_error(result), do: result
end
