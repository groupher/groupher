defmodule GroupherServer.CMS.Articles.Commands.SaveWorkingCopy do
  @moduledoc """
  Saves one complete WorkingCopy patch after Gate admission and the client revision check.

      saveWorkingCopy -> Gate / Article lock -> revision check -> content owner writes
        -> incremented revision confirmation -> Receipt replay result
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  import Ecto.Query

  alias GroupherServer.{CMS, Repo, Accounts}
  alias Accounts.Model.User
  alias CMS.Articles.Commands.SaveWorkingCopyConfirmation, as: Confirmation
  alias CMS.Articles.{Bindings, WorkingCopy.Store}
  alias CMS.Articles.WorkingCopy.History
  alias CMS.Articles.WorkingCopy.Access, as: WorkingCopyAccess
  alias CMS.Model.{Article, ArticleWorkingCopy, Community}

  @pipeline operation: :article_save_working_copy,
            confirmation: Confirmation,
            target: :article,
            params: [:working_copy_id, :attrs, :revision, :community_id, :history_context]
  receipt_pipeline run_receipt(
                     article,
                     community,
                     working_copy_id,
                     attrs,
                     revision,
                     actor,
                     command_id,
                     community_id,
                     history_context
                   ) do
    gate(fn _article ->
      action = if article.thread in [:post, :blog, :changelog], do: :edit_article, else: :edit
      WorkingCopyAccess.check_in_transaction(actor, action, article, community)
    end)

    change(fn canonical_article, %{operation_ref: operation_ref} ->
      history_context = Map.put(history_context, :causation_command_id, command_id)

      with %ArticleWorkingCopy{} = work <-
             Repo.one(
               from(work in ArticleWorkingCopy,
                 where: work.id == ^working_copy_id and work.article_id == ^canonical_article.id
               )
             ),
           {:ok, :pass} <- WorkingCopyAccess.generic_save(canonical_article, work),
           {:ok, saved} <-
             save(
               canonical_article,
               work,
               attrs,
               actor,
               revision,
               community_id,
               operation_ref,
               history_context
             ) do
        {:ok, saved}
      else
        nil ->
          {:error, :working_copy_not_found}

        {:error, :revision_conflict} ->
          {:error, CMS.ErrorCat.article_working_copy_revision_conflict()}

        {:error, _reason} = error ->
          error
      end
    end)

    confirm(fn saved ->
      {:ok,
       %Confirmation{
         data: %{
           "working_copy_id" => saved.id,
           "revision" => saved.revision,
           "command_id" => command_id
         }
       }}
    end)

    present(fn confirmation -> present_confirmation(confirmation, article, community, actor) end)
  end

  def execute(
        article,
        community,
        working_copy_id,
        attrs,
        revision,
        actor,
        command_id,
        history_context \\ %{source: :browser, service_ref: nil}
      )

  def execute(
        %Article{} = article,
        %Community{} = community,
        working_copy_id,
        attrs,
        revision,
        %User{} = actor,
        command_id,
        %{source: source, service_ref: service_ref} = history_context
      )
      when is_binary(working_copy_id) and is_map(attrs) and is_integer(revision) and
             is_binary(command_id) and source in [:browser, :import, :system] and
             (is_nil(service_ref) or is_binary(service_ref)) do
    with {:ok, _binding} <- Bindings.get(article, community) do
      run_receipt(
        article,
        community,
        working_copy_id,
        Map.drop(attrs, [:command_id, "command_id", :cur_user, "cur_user"]),
        revision,
        actor,
        command_id,
        community.id,
        history_context
      )
    end
  end

  def execute(
        _article,
        _community,
        _working_copy_id,
        _attrs,
        _expected,
        _actor,
        _command_id,
        _history_context
      ) do
    {:error, :invalid_working_copy_command}
  end

  defp save(
         %Article{thread: thread} = article,
         work,
         attrs,
         actor,
         revision,
         community_id,
         command_id,
         history_context
       )
       when thread in [:post, :blog, :changelog, :doc] do
    event_attrs = History.event_attrs(actor, command_id, community_id, history_context, 0)

    if work.revision == revision do
      History.record_save_in_transaction(article, work, actor, command_id, event_attrs, fn ->
        Store.save_loaded(work, attrs, actor, revision, community_id)
      end)
    else
      {:error, :revision_conflict}
    end
  end

  defp save(_article, work, attrs, actor, revision, community_id, _command_id, _history_context) do
    Store.save_loaded(work, attrs, actor, revision, community_id)
  end

  defp present_confirmation(
         %Confirmation{data: %{"working_copy_id" => id, "revision" => revision}},
         %Article{} = article,
         community,
         actor
       ) do
    with {:ok, canonical} <- WorkingCopyAccess.access_check(actor, :edit, article, community),
         %ArticleWorkingCopy{article_id: article_id, revision: ^revision} = work <-
           Repo.get(ArticleWorkingCopy, id),
         true <- article_id == canonical.id,
         {:ok, :pass} <- WorkingCopyAccess.generic_save(canonical, work) do
      {:ok, work}
    else
      {:error, _reason} -> {:error, CMS.ErrorCat.command_result_unavailable()}
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp present_confirmation(_confirmation, _article, _community, _actor) do
    {:error, CMS.ErrorCat.command_result_unavailable()}
  end
end
