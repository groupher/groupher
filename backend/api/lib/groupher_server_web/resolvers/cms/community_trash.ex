defmodule GroupherServerWeb.Resolvers.CMS.CommunityTrash do
  @moduledoc """
  Resolves actor-scoped ordinary Community Article Trash operations.

      Community ref -> readable Community -> Passport / Command -> local Trash
  """
  alias GroupherServer.{CMS, Pagi}
  alias CMS.Articles.{Commands.CommunityHide, Commands.CommunityRestore, CommunityTrashQuery}

  @ordinary [:post, :blog, :changelog]

  def page(_root, %{community_ref: ref, thread: thread} = args, %{context: %{cur_user: actor}}) do
    with {:ok, community} <- community(ref, actor),
         {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CommunityTrashQuery.page(community, actor, thread, pagi)
    end
  end

  def get(_root, %{community_ref: ref, thread: thread, id: id}, %{context: %{cur_user: actor}}) do
    with {:ok, community} <- community(ref, actor) do
      CommunityTrashQuery.get(community, actor, thread, id)
    end
  end

  def hide(
        _root,
        %{community_ref: ref, thread: thread, article_id: id, command_id: command_id},
        %{context: %{cur_user: actor}}
      )
      when thread in @ordinary do
    with {:ok, community} <- community(ref, actor),
         {:ok, :pass} <- authorize_mutation(community, actor, "community.article.hide", thread),
         {:ok, :pass} <- match_thread(id, thread) do
      CommunityHide.execute(community, id, actor, command_id)
    end
  end

  def hide(_, _, _), do: {:error, CMS.articles_error_cat_unsupported_community_trash_thread()}

  def restore(
        _root,
        %{
          community_ref: ref,
          thread: thread,
          article_id: article_id,
          id: id,
          record_revision: revision,
          command_id: command_id
        },
        %{context: %{cur_user: actor}}
      )
      when thread in @ordinary do
    with {:ok, community} <- community(ref, actor),
         {:ok, :pass} <- authorize_mutation(community, actor, "community.article.restore", thread),
         {:ok, :pass} <- match_thread(article_id, thread) do
      CommunityRestore.execute(community, article_id, id, revision, actor, command_id)
    end
  end

  def restore(_, _, _) do
    {:error, CMS.articles_error_cat_unsupported_community_trash_thread()}
  end

  defp match_thread(id, thread) do
    with {:ok, true} <- CommunityTrashQuery.article_thread_matches?(id, thread) do
      {:ok, :pass}
    else
      _ -> {:error, CMS.gate_error_cat_resource_not_found()}
    end
  end

  defp authorize_mutation(community, actor, action, thread) do
    with {:ok, scope} <- CMS.passport_community_scope(actor, community),
         {:ok, true} <- CMS.passport_allowed?(actor, scope, action, thread) do
      {:ok, :pass}
    else
      _ -> {:error, CMS.gate_error_cat_resource_not_found()}
    end
  end

  defp community(ref, actor) do
    case CMS.front_desk_community(ref, actor, mode: :public) do
      {:ok, community} -> {:ok, community}
      {:error, _} -> CMS.front_desk_community(ref, actor, mode: :admin)
    end
  end
end
