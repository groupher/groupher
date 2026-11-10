defmodule GroupherServer.CMS.Articles.Commands.ForkSnapshot do
  @moduledoc """
  Creates an independently editable WorkingCopy from an immutable Article Snapshot.

      forkSnapshot -> Gate / Article lock -> source Snapshot -> cloned content + owner refs
        -> WorkingCopy confirmation -> Receipt replay result
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles.Commands.ForkSnapshotConfirmation, as: Confirmation
  alias CMS.Articles.Bindings
  alias CMS.Articles.WorkingCopy.Access, as: WorkingCopyAccess
  alias CMS.Articles.WorkingCopy.Snapshotter
  alias CMS.Model.{ArticleSnapshot, ArticleWorkingCopy, Community}

  @pipeline operation: :article_fork_snapshot,
            confirmation: Confirmation,
            target: :article,
            params: [:snapshot_id, :scope_kind, :scope_id]

  receipt_pipeline run_receipt(
                     article,
                     snapshot_id,
                     scope_kind,
                     scope_id,
                     community,
                     actor,
                     command_id
                   ) do
    gate(fn _article ->
      WorkingCopyAccess.check_in_transaction(actor, :edit, article, community)
    end)

    change(fn canonical_article ->
      with %ArticleSnapshot{article_id: article_id} = snapshot <-
             Repo.get(ArticleSnapshot, snapshot_id),
           true <- article_id == canonical_article.id,
           {:ok, work} <-
             Snapshotter.fork_snapshot_in_transaction(
               snapshot.id,
               %{
                 article_id: canonical_article.id,
                 scope_kind: scope_kind,
                 scope_id: scope_id
               },
               actor
             ) do
        {:ok, %{working_copy: work}}
      else
        nil -> {:error, :snapshot_not_found}
        false -> {:error, :snapshot_owner_mismatch}
        {:error, _reason} = error -> error
      end
    end)

    confirm(fn %{working_copy: work} ->
      {:ok,
       %Confirmation{
         data: %{
           "article_id" => work.article_id,
           "working_copy_id" => work.id,
           "command_id" => command_id
         }
       }}
    end)

    present(fn confirmation -> present_confirmation(confirmation) end)
  end

  def execute(
        snapshot_id,
        %Community{} = community,
        scope_kind,
        scope_id,
        %User{} = actor,
        command_id
      )
      when is_binary(snapshot_id) and scope_kind in [:default, :workspace] and
             is_binary(scope_id) and is_binary(command_id) do
    with %ArticleSnapshot{} = snapshot <- Repo.get(ArticleSnapshot, snapshot_id),
         {:ok, article} <- CMS.FrontDesk.article(snapshot.article_id, mode: :internal),
         {:ok, _binding} <- Bindings.get(article, community) do
      run_receipt(
        article,
        snapshot_id,
        scope_kind,
        scope_id,
        community,
        actor,
        command_id
      )
    else
      nil -> {:error, :snapshot_not_found}
      {:error, _reason} = error -> error
    end
  end

  def execute(_snapshot_id, _community, _scope_kind, _scope_id, _actor, _command_id),
    do: {:error, :invalid_working_copy_command}

  defp present_confirmation(%Confirmation{
         data: %{"article_id" => article_id, "working_copy_id" => working_copy_id}
       }) do
    with {:ok, article} <- CMS.FrontDesk.article(article_id, mode: :internal),
         %ArticleWorkingCopy{} = work <- Repo.get(ArticleWorkingCopy, working_copy_id),
         true <- work.article_id == article.id do
      {:ok, %{working_copy: work}}
    else
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp present_confirmation(_), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
