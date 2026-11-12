defmodule GroupherServer.CMS.Articles.Effects.Publish do
  @moduledoc """
  Starts post-commit projections after a stable Article Publish succeeds.

      committed Publish result
        -> first-publication metadata (when applicable)
        -> administrator notification

  Press, Search and CDN delivery use independent durable outbox tasks; the
  Article content Activity is recorded in its Snapshot publication transaction;
  Docs publication Activity belongs to the Queue Release transaction.
  """

  alias GroupherServer.{CMS, Messaging}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.FrontDesk
  alias CMS.Model.Article

  @doc """
  Enqueues or schedules the rebuildable projections for one committed result.

  ## Examples

      Effects.run(%{article: article, snapshot: snapshot})
  """
  @spec run(%{required(:article) => Article.t()}) :: {:ok, map()} | {:error, term()}
  def run(%{article: %Article{}} = result), do: run_public_effects(result)

  def run(_result), do: {:error, ArticleErrorCat.binding_context_required()}

  defp run_public_effects(
         %{article: %Article{} = article, community: community, binding: %{inner_id: inner_id}} =
           result
       ) do
    with true <- match?(%CMS.Model.Community{}, community),
         true <- is_integer(inner_id),
         {:ok, public} <- public_projection(article, community, inner_id),
         {:ok, _user} <- update_published_projection(result, public) do
      with {:ok, _} <- notify_admin_on_first_publish(result, article) do
        {:ok, result}
      end
    else
      false -> {:error, ArticleErrorCat.binding_context_required()}
      {:error, reason} -> {:error, reason}
    end
  end

  defp notify_admin_on_first_publish(
         %{first_publish?: true, community: community},
         %Article{} = article
       ) do
    notify_admin_new_article(%{
      target: Article,
      id: article.id,
      thread: article.thread,
      community: community
    })
  end

  defp notify_admin_on_first_publish(_result, _article), do: {:ok, :pass}

  defp update_published_projection(%{first_publish?: true}, %{author: user}) do
    GroupherServer.FrontDesk.revalidate_user(user.login)
  end

  defp update_published_projection(_result, _public), do: {:ok, :pass}

  @doc "Notifies community administrators after the first official Article publish."
  def notify_admin_new_article(%{target: target, id: id, thread: thread, community: community})
      when is_atom(target) and is_atom(thread) do
    do_notify_admin_new_article(target, id, thread, community)
  end

  def notify_admin_new_article(%{target: target, id: id, community: community})
      when is_atom(target) do
    do_notify_admin_new_article(target, id, nil, community)
  end

  defp do_notify_admin_new_article(target, id, thread, community) do
    with {:ok, article} <-
           CMS.FrontDesk.article(id, mode: :internal, view: :command_context),
         {:ok, %{community: ^community}} <-
           CMS.Articles.Bindings.get(%{article_id: article.id}, community) do
      info = %{
        id: article.id,
        title: article.title,
        digest: Map.get(article, :digest, article.title),
        author_name: article.author.user.nickname,
        community_slug: community.slug,
        type:
          thread ||
            target |> to_string() |> String.split(".") |> List.last() |> String.downcase()
      }

      Messaging.notify(:notify_admin_new_article, info)
    end
  end

  defp public_projection(%Article{thread: thread}, community, inner_id)
       when is_integer(inner_id) do
    FrontDesk.article(%{
      community: community.slug,
      thread: thread,
      inner_id: inner_id
    })
  end
end
