defmodule GroupherServer.CMS.Articles.Writer do
  @moduledoc """
  Publish-adjacent helpers that do not own Article content lifecycle.

  Draft/Publish own content writes. Trash owns soft deletion, restore and
  permanent deletion; this module only keeps Author creation and first-publish
  notification helpers used by those write paths.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Writer
        -> Repo / domain event
  """

  alias GroupherServer.{Accounts, CMS, Messaging, Repo}

  alias Accounts.Model.User
  alias CMS.Articles.Reader
  alias CMS.Model.{Article, Author, Community}
  alias Helper.{ORM, T}

  @doc "Publishes one Gate-authorized Article and commits all first-publish side effects atomically."
  def publish(%Article{} = article, %Author{} = author, actor, opts) do
    Repo.transaction(fn ->
      with {:ok, published} <- CMS.Articles.Publish.Target.publish(article, author, opts),
           {:ok, _finalized} <- finalize_first_publish(published, actor),
           {:ok, _events} <- enqueue_publish_events(published, opts) do
        published
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc "Notifies community administrators after the first official Article publish."
  @spec notify_admin_new_article(map()) :: T.domain_res(term())
  def notify_admin_new_article(%{target: target, id: id, thread: thread})
      when is_atom(target) and is_atom(thread) do
    do_notify_admin_new_article(target, id, thread)
  end

  def notify_admin_new_article(%{target: target, id: id}) when is_atom(target) do
    do_notify_admin_new_article(target, id)
  end

  @doc false
  def notify_admin_new_article(%{__struct__: target, id: id}) do
    do_notify_admin_new_article(target, id)
  end

  defp do_notify_admin_new_article(target, id, thread \\ nil) do
    with {:ok, article} <- Reader.article_with_context(id) do
      info = %{
        id: article.id,
        title: article.title,
        digest: Map.get(article, :digest, article.title),
        author_name: article.author.user.nickname,
        community_slug: article.community.slug,
        type:
          thread ||
            target |> to_string() |> String.split(".") |> List.last() |> String.downcase()
      }

      Messaging.notify(:notify_admin_new_article, info)
    end
  end

  @doc "Returns or creates the CMS Author row associated with a User."
  @spec ensure_author_exists(User.t()) :: {:ok, Author.t()}
  def ensure_author_exists(%User{} = user) do
    case ORM.find_by(Author, user_id: user.id) do
      {:ok, author} ->
        {:ok, author}

      {:error, _} ->
        %Author{user_id: user.id}
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.unique_constraint(:user_id)
        |> Ecto.Changeset.foreign_key_constraint(:user_id)
        |> Repo.insert()
    end
  end

  defp enqueue_publish_events(
         %{article: %Article{} = article, public: public, first_publish?: first_publish?} = result,
         opts
       ) do
    command_id = Keyword.get(opts, :outbox_command_id, Ecto.UUID.generate())

    with {:ok, %Community{} = community} <- Reader.community(article.community_id),
         {:ok, cache_event} <-
           CMS.Outbox.send(%{
             event: if(first_publish?, do: "article.published", else: "article.updated"),
             worker: CMS.Outbox.Workers.Article.Cleanup,
             resource_type: "article",
             resource_id: article.id,
             command_id: command_id,
             data: %{
               community: community.slug,
               community_id: community.id,
               thread: article.thread,
               inner_id: article.inner_id,
               article_id: article.id,
               revision_id: public.revision_id
             }
           }),
         {:ok, projection_event} <-
           CMS.Outbox.send(%{
             event: "article.projections",
             worker: CMS.Outbox.Workers.Article.Cleanup,
             resource_type: "article",
             resource_id: article.id,
             command_id: command_id,
             data: %{
               first_publish?: first_publish?,
               changed_fields: Map.get(result, :changed_fields, []),
               published_by_id: Map.get(result, :published_by_id),
               revision_id: public.revision_id
             }
           }) do
      {:ok, %{cache: cache_event, projections: projection_event}}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp finalize_first_publish(%{first_publish?: false} = result, _actor), do: {:ok, result}

  defp finalize_first_publish(
         %{first_publish?: true, article: %Article{} = article} = result,
         actor
       ) do
    with {:ok, %Community{} = community} <- Reader.community(article.community_id),
         %User{} = user <- actor_user(actor),
         {:ok, _community} <- CMS.Communities.update_count_field(community, article.thread),
         {:ok, _user} <- Accounts.Publish.update_states(user, article.thread),
         {:ok, _throttle} <- CMS.Gate.RateLimit.Publish.record(user) do
      {:ok, result}
    else
      {:error, reason} -> {:error, reason}
      _ -> {:error, :publish_finalization_context_not_found}
    end
  end

  defp actor_user(%User{} = user), do: user
  defp actor_user(%Author{user: %User{} = user}), do: user

  defp actor_user(%Author{user_id: user_id}) do
    case GroupherServer.FrontDesk.fresh_user(user_id) do
      {:ok, %User{} = user} -> user
      _ -> nil
    end
  end
end
