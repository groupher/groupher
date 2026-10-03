defmodule GroupherServer.CMS.Articles.Publish.Effects do
  @moduledoc """
  Starts post-commit projections after a stable Article Publish succeeds.

      committed Publish result
        -> Search enqueue + Press invalidation
        -> mention sync + moderation audition

  Durable PublicCache invalidation remains inside the Publish transaction; the
  effects here consume only stable Article identity and the committed public
  projection.
  """

  alias GroupherServer.{Activity, CMS, Repo}
  alias CMS.Articles.Writer
  alias CMS.FrontDesk
  alias CMS.Model.{Article, Author, Community}
  alias Helper.Later

  @doc """
  Enqueues or schedules the rebuildable projections for one committed result.

  ## Examples

      Effects.run(%{article: article, revision: revision})
  """
  @spec run(%{required(:article) => Article.t()}) :: {:ok, map()} | {:error, term()}
  def run(%{article: %Article{inner_id: inner_id}} = result) when not is_integer(inner_id),
    do: {:ok, result}

  def run(%{article: %Article{} = article} = result) do
    with {:ok, :pass} <- CMS.SearchArtiments.Indexer.enqueue_upsert(article),
         %Community{} = community <- Repo.get(Community, article.community_id),
         {:ok, public} <- public_projection(article, community),
         :ok <- append_activity(result, public) do
      Later.run({CMS.Press, :invalidate, [article.community_id]})
      Later.run({CMS.Events, :emit, [:sync_mentions, %{artiment: public}]})
      Later.run({CMS.Events, :emit, [:audition, %{artiment: public}]})
      notify_admin_on_first_publish(result, article)
      {:ok, result}
    else
      nil -> {:error, :community_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp notify_admin_on_first_publish(%{first_publish?: true}, %Article{} = article) do
    Later.run(
      {Writer, :notify_admin_new_article,
       [%{target: Article, id: article.id, thread: article.thread}]}
    )
  end

  defp notify_admin_on_first_publish(_result, _article), do: :ok

  defp public_projection(%Article{inner_id: inner_id, thread: thread}, community)
       when is_integer(inner_id) do
    FrontDesk.article(%{
      community: community.slug,
      thread: thread,
      inner_id: inner_id
    })
  end

  defp append_activity(%{article: %Article{thread: :doc}} = result, public) do
    with {:ok, actor} <- published_by(result),
         {:ok, _event} <-
           Activity.log(public, :published,
             actor: actor,
             metadata: %{
               revision_id: result.revision.id,
               branch_version_id: result.version.id
             }
           ) do
      :ok
    end
  end

  defp append_activity(%{first_publish?: true}, _public), do: :ok

  defp append_activity(result, public) do
    with {:ok, actor} <- published_by(result),
         :ok <- maybe_log_title_change(result, public, actor),
         :ok <- maybe_log_body_change(result, public, actor) do
      :ok
    end
  end

  defp maybe_log_title_change(%{changed_fields: fields} = result, public, actor) do
    if :title in fields do
      normalize_activity(
        Activity.log(public, :title_changed,
          actor: actor,
          changed_fields: [:title],
          metadata: %{revision_id: result.revision.id}
        )
      )
    else
      :ok
    end
  end

  defp maybe_log_body_change(%{changed_fields: fields} = result, public, actor) do
    if :body_hash in fields do
      normalize_activity(
        Activity.log(public, :body_updated,
          actor: actor,
          changed_fields: [:body_hash],
          metadata: %{revision_id: result.revision.id}
        )
      )
    else
      :ok
    end
  end

  defp published_by(%{published_by_id: author_id}) do
    case Repo.get(Author, author_id) do
      %Author{} = author -> {:ok, author |> Repo.preload(:user) |> Map.fetch!(:user)}
      nil -> {:error, :publish_actor_not_found}
    end
  end

  defp normalize_activity({:ok, _event}), do: :ok
  defp normalize_activity({:error, reason}), do: {:error, reason}
end
