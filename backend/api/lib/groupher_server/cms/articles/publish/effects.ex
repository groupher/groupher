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
  alias CMS.Model.{Article, Author}
  alias Helper.Later

  @doc """
  Enqueues or schedules the rebuildable projections for one committed result.

  ## Examples

      Effects.run(%{article: article, branch_type: :main, revision: revision})
  """
  @spec run(%{required(:article) => Article.t()}) :: {:ok, map()} | {:error, term()}
  def run(%{article: %Article{thread: :doc}, branch_type: :main} = result),
    do: run_public_effects(result)

  def run(%{article: %Article{thread: :doc}, branch_type: _branch_type} = result),
    do: {:ok, result}

  def run(%{article: %Article{}} = result), do: run_public_effects(result)

  def run(_result), do: {:error, :article_binding_context_required}

  defp run_public_effects(
         %{article: %Article{} = article, community: community, binding: %{inner_id: inner_id}} =
           result
       ) do
    with true <- match?(%CMS.Model.Community{}, community),
         true <- is_integer(inner_id),
         {:ok, :pass} <- CMS.SearchArtiments.Indexer.enqueue_upsert(article),
         {:ok, public} <- public_projection(article, community, inner_id),
         {:ok, _} <- append_activity(result, Map.put(public, :community_id, community.id)) do
      Later.run({CMS.Press, :invalidate, [community.id]})
      Later.run({CMS.Events, :emit, [:sync_mentions, %{artiment: public}]})
      Later.run({CMS.Events, :emit, [:audition, %{artiment: public}]})
      notify_admin_on_first_publish(result, article)
      {:ok, result}
    else
      false -> {:error, :article_binding_context_required}
      {:error, reason} -> {:error, reason}
    end
  end

  defp notify_admin_on_first_publish(
         %{first_publish?: true, community: community},
         %Article{} = article
       ) do
    Later.run(
      {Writer, :notify_admin_new_article,
       [%{target: Article, id: article.id, thread: article.thread, community: community}]}
    )
  end

  defp notify_admin_on_first_publish(_result, _article), do: {:ok, :pass}

  defp public_projection(%Article{thread: thread}, community, inner_id)
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
      {:ok, :pass}
    end
  end

  defp append_activity(%{first_publish?: true}, _public), do: {:ok, :pass}

  defp append_activity(result, public) do
    with {:ok, actor} <- published_by(result),
         {:ok, _} <- maybe_log_title_change(result, public, actor),
         {:ok, _} <- maybe_log_body_change(result, public, actor) do
      {:ok, :pass}
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
      {:ok, :pass}
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
      {:ok, :pass}
    end
  end

  defp published_by(%{published_by_id: author_id}) do
    case Repo.get(Author, author_id) do
      %Author{} = author -> {:ok, author |> Repo.preload(:user) |> Map.fetch!(:user)}
      nil -> {:error, :publish_actor_not_found}
    end
  end

  defp normalize_activity({:ok, _event}), do: {:ok, :pass}
  defp normalize_activity({:error, reason}), do: {:error, reason}
end
