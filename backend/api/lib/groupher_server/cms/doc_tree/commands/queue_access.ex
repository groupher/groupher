defmodule GroupherServer.CMS.DocTree.Commands.QueueAccess do
  @moduledoc """
  Authorizes a Doc's editable binding for Queue commands.

      Docs Queue command -> QueueAccess -> Gate article binding decision
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Gate.Decision
  alias CMS.Model.{Article, ArticleWorkingCopy, Community, DocsPublishQueue, DocsQueueArticle}

  @doc "Checks edit access to the Doc in the specified community."
  def authorize(community, article_id, actor) do
    with {:ok, article_id} <- Ecto.UUID.cast(article_id),
         %Article{thread: :doc} = article <- Repo.get(Article, article_id) do
      CMS.Gate.Access.Check.with_authorized_article_binding(
        actor,
        :edit,
        {community, article},
        fn _ -> {:ok, :pass} end
      )
    else
      _ -> {:error, :invalid_doc_identity}
    end
  end

  @doc "Rechecks current Doc edit access through Gate after a Receipt commits."
  def authorize_after_commit(community, article_id, actor) do
    with {:ok, article_id} <- Ecto.UUID.cast(article_id),
         %Article{thread: :doc} = article <- Repo.get(Article, article_id) do
      CMS.Gate.with_community_check(actor, :edit, community, article, fn _ -> {:ok, :pass} end)
    else
      nil -> {:error, :invalid_doc_identity}
      :error -> {:error, :invalid_doc_identity}
      {:error, _} = error -> error
    end
  end

  @doc "Allows existing Queue-body writes through site Queue access or this Doc's Article update grant."
  def authorize_body_write(community, article_id, actor) do
    case site_queue_write_in_transaction(community, actor) do
      {:ok, canonical} ->
        {:ok, canonical}

      {:error, %Decision{} = decision} = error ->
        if permission_denied?(decision) do
          with {:ok, :pass} <- authorize_member_edit(community, article_id, actor) do
            {:ok, community}
          end
        else
          error
        end

      error ->
        error
    end
  end

  @doc "Rechecks existing Queue-body write admission after the Receipt commits."
  def authorize_body_write_after_commit(community, article_id, actor) do
    case site_queue_write_after_commit(community, actor) do
      {:ok, canonical} ->
        with {:ok, :pass} <- authorize_after_commit(canonical, article_id, actor) do
          {:ok, canonical}
        end

      {:error, %Decision{} = decision} = error ->
        if permission_denied?(decision) do
          with {:ok, :pass} <- authorize_member_edit_after_commit(community, article_id, actor) do
            {:ok, community}
          end
        else
          error
        end

      error ->
        error
    end
  end

  @doc "Rechecks existing Queue-body edit admission inside the Receipt transaction."
  def authorize_body_edit(community, article_id, actor) do
    case authorize(community, article_id, actor) do
      {:ok, :pass} = result ->
        result

      {:error, %Decision{} = decision} = error ->
        if permission_denied?(decision) do
          authorize_member_edit(community, article_id, actor)
        else
          error
        end

      error ->
        error
    end
  end

  @doc "Reads only the active Queue copy for one Doc after Article draft-read and update admission."
  def read_member(%Community{} = community, article_id, actor) do
    Repo.transact(fn ->
      with {:ok, article_id} <- Ecto.UUID.cast(article_id),
           %Article{thread: :doc} = article <-
             Repo.get(Article, article_id) |> Repo.preload(:author),
           {:ok, :pass} <- authorize_body_read(community, article, actor) do
        community_id = community.id

        member_query =
          from(member in DocsQueueArticle,
            join: queue in DocsPublishQueue,
            on: queue.id == member.queue_id and queue.community_id == ^community_id,
            join: work in ArticleWorkingCopy,
            on:
              work.id == member.working_copy_id and work.article_id == member.article_id and
                work.scope_type == :workspace and work.scope_id == queue.id,
            where: member.article_id == ^article_id,
            select: {queue.queue_revision, work}
          )

        case Repo.one(member_query) do
          {queue_revision, %ArticleWorkingCopy{} = work} ->
            {:ok, %{queue_revision: queue_revision, working_copy: work}}

          nil ->
            {:ok, nil}
        end
      else
        nil -> {:error, :invalid_doc_identity}
        :error -> {:error, :invalid_doc_identity}
        {:error, _} = error -> error
      end
    end)
  end

  defp authorize_body_read(community, article, actor) do
    case site_queue_write_after_commit(community, actor) do
      {:ok, _canonical} ->
        authorize_after_commit(community, article.id, actor)

      {:error, %Decision{} = decision} = error ->
        if permission_denied?(decision) do
          authorize_member_read(community, article, actor)
        else
          error
        end

      error ->
        error
    end
  end

  defp authorize_member_read(community, article, actor) do
    with {:ok, article_scope} <- CMS.Passport.load_article_scope(actor, article),
         {:ok, true} <-
           CMS.Passport.allowed?(
             actor,
             article_scope,
             CMS.GateAction.article_read_draft()
           ),
         {:ok, :pass} <- authorize_member_edit(community, article.id, actor) do
      {:ok, :pass}
    else
      _ -> {:error, CMS.Gate.ErrorCat.permission_denied()}
    end
  end

  defp authorize_member_edit(community, article_id, actor) do
    with {:ok, article_id} <- Ecto.UUID.cast(article_id),
         %Article{thread: :doc} = article <- Repo.get(Article, article_id) do
      CMS.Gate.Access.Check.with_authorized_article_binding(
        actor,
        :edit_article,
        {community, article},
        fn _ -> {:ok, :pass} end
      )
    else
      _ -> {:error, :invalid_doc_identity}
    end
  end

  defp authorize_member_edit_after_commit(community, article_id, actor) do
    with {:ok, article_id} <- Ecto.UUID.cast(article_id),
         %Article{thread: :doc} = article <- Repo.get(Article, article_id) do
      CMS.Gate.with_community_check(actor, :edit_article, community, article, fn _ ->
        {:ok, :pass}
      end)
    else
      nil -> {:error, :invalid_doc_identity}
      :error -> {:error, :invalid_doc_identity}
      {:error, _} = error -> error
    end
  end

  defp site_queue_write_in_transaction(community, actor) do
    with {:ok, canonical} <- CMS.Gate.check_in_transaction(actor, :docs_queue_write, community),
         {:ok, canonical} <- CMS.Gate.check_in_transaction(actor, :docs_queue_preview, canonical) do
      {:ok, canonical}
    end
  end

  defp site_queue_write_after_commit(community, actor) do
    with {:ok, canonical} <- CMS.Gate.access_check(actor, :docs_queue_write, community),
         {:ok, canonical} <- CMS.Gate.access_check(actor, :docs_queue_preview, canonical) do
      {:ok, canonical}
    end
  end

  defp permission_denied?(decision) do
    match?(%{reason: :permission_denied}, Decision.primary_error(decision))
  end
end
