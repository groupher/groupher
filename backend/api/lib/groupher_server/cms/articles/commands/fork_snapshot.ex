defmodule GroupherServer.CMS.Articles.Commands.ForkSnapshot do
  @moduledoc """
  Creates an independently editable WorkingCopy from an immutable Article Snapshot.

      forkSnapshot -> Gate / Article lock -> source Snapshot -> cloned content + owner refs
        -> WorkingCopy confirmation -> Receipt replay result
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{CMS, Repo, Accounts}
  alias Accounts.Model.User
  alias CMS.Articles.Commands.ForkSnapshotConfirmation, as: Confirmation
  alias CMS.Articles.{Bindings, WorkingCopy.Snapshotter}
  alias CMS.Articles.WorkingCopy.History
  alias CMS.Articles.WorkingCopy.Access, as: WorkingCopyAccess
  alias CMS.Model.{ArticleSnapshot, ArticleWorkingCopy, Community}

  @pipeline operation: :article_fork_snapshot,
            confirmation: Confirmation,
            target: :article,
            params: [:snapshot_id, :scope_type, :scope_id, :history_context]

  receipt_pipeline run_receipt(
                     article,
                     snapshot_id,
                     scope_type,
                     scope_id,
                     community,
                     actor,
                     command_id,
                     history_context
                   ) do
    gate(fn _article ->
      action = if article.thread in [:post, :blog, :changelog], do: :edit_article, else: :edit
      with {:ok, :pass} <-
             CMS.Articles.CoAuthors.reject_member_working_copy_access(article, actor) do
        WorkingCopyAccess.check_in_transaction(actor, action, article, community)
      end
    end)

    change(fn canonical_article, operation_ref ->
      history_context = Map.put(history_context, :causation_command_id, command_id)

      with {:ok, :pass} <- WorkingCopyAccess.generic_snapshot_mutation(canonical_article),
           %ArticleSnapshot{article_id: article_id} = snapshot <-
             Repo.get(ArticleSnapshot, snapshot_id),
           true <- article_id == canonical_article.id,
           {:ok, work} <-
             Snapshotter.fork_snapshot_in_transaction(
               snapshot.id,
               %{
                 article_id: canonical_article.id,
                 scope_type: scope_type,
                 scope_id: scope_id
               },
               actor
             ),
           event_attrs =
             History.event_attrs(actor, operation_ref, community.id, history_context, 0)
             |> Map.merge(%{type: :fork, source_snapshot_id: snapshot.id}),
           {:ok, _event} <-
             History.record_initial_in_transaction(
               canonical_article,
               work,
               actor,
               operation_ref,
               event_attrs
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

    present(fn confirmation -> present_confirmation(confirmation, article, community, actor) end)
  end

  @doc "Creates an independent WorkingCopy from a same-Article Snapshot through an authorized command."
  def execute(
        snapshot_id,
        community,
        scope_type,
        scope_id,
        actor,
        command_id,
        history_context \\ %{source: :browser, service_ref: nil}
      )

  def execute(
        snapshot_id,
        %Community{} = community,
        scope_type,
        scope_id,
        %User{} = actor,
        command_id,
        %{source: source, service_ref: service_ref} = history_context
      )
      when is_binary(snapshot_id) and scope_type in [:default, :workspace] and
             is_binary(scope_id) and is_binary(command_id) and
             source in [:browser, :import, :system] and
             (is_nil(service_ref) or is_binary(service_ref)) do
    with %ArticleSnapshot{} = snapshot <- Repo.get(ArticleSnapshot, snapshot_id),
         {:ok, article} <- CMS.FrontDesk.article(snapshot.article_id, mode: :internal),
         {:ok, _binding} <- Bindings.get(article, community),
         {:ok, :pass} <- WorkingCopyAccess.generic_snapshot_mutation(article) do
      run_receipt(
        article,
        snapshot_id,
        scope_type,
        scope_id,
        community,
        actor,
        command_id,
        history_context
      )
    else
      nil -> {:error, :snapshot_not_found}
      {:error, %{reason: :docs_managed_content}} = error -> error
      {:error, _reason} -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  def execute(
        _snapshot_id,
        _community,
        _scope_type,
        _scope_id,
        _actor,
        _command_id,
        _history_context
      ) do
    {:error, :invalid_working_copy_command}
  end

  defp present_confirmation(
         %Confirmation{data: %{"article_id" => article_id, "working_copy_id" => working_copy_id}},
         article,
         community,
         actor
       ) do
    with true <- article.id == article_id,
         {:ok, article} <- WorkingCopyAccess.access_check(actor, :edit, article, community),
         {:ok, :pass} <- WorkingCopyAccess.generic_snapshot_mutation(article),
         %ArticleWorkingCopy{} = work <- Repo.get(ArticleWorkingCopy, working_copy_id),
         true <- work.article_id == article.id do
      {:ok, %{working_copy: work}}
    else
      {:error, _reason} -> {:error, CMS.ErrorCat.command_result_unavailable()}
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp present_confirmation(_, _, _, _), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
