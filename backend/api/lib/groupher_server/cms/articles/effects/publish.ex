defmodule GroupherServer.CMS.Articles.Effects.Publish do
  @moduledoc """
  Starts post-commit projections after a stable Article Publish succeeds.

      committed Publish result
        -> rebuildable author/public projections

  First-publication notifications are delivered separately from their frozen
  Outbox payload; rebuilding a projection never creates that notification.

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
      {:ok, result}
    else
      false -> {:error, ArticleErrorCat.binding_context_required()}
      {:error, reason} -> {:error, reason}
    end
  end

  defp update_published_projection(_result, %{author: user}) do
    GroupherServer.FrontDesk.revalidate_user(user.login)
  end

  defp update_published_projection(_result, _public), do: {:ok, :pass}

  @doc "Delivers the recipient and content snapshot stored by the first-publish intent."
  def deliver_first_publish_notification(%{event: "article.first_published_notification"} = event) do
    Messaging.notify(:notify_admin_new_article, event)
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
