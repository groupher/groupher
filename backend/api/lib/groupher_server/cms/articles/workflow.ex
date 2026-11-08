defmodule GroupherServer.CMS.Articles.Workflow do
  @moduledoc """
  Publish-adjacent helpers that do not own Article content lifecycle.

  Draft/Publish own content writes. Trash owns soft deletion, restore and
  permanent deletion; this module only owns the bounded multi-step publish
  transaction and first-publish finalization.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Articles.Workflow (multi-step publish transaction)
        -> Repo / domain event
  """

  alias GroupherServer.{Accounts, CMS, Repo}
  alias GroupherServer.FrontDesk, as: RootFrontDesk

  alias Accounts.Model.User

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleBodySnapshot,
    ArticleRevision,
    Author,
    Community
  }

  alias CMS.Articles.Effects
  alias CMS.Artiment.PlateJSON
  alias CMS.ArtimentMentions
  alias Helper.ORM

  @doc "Runs an Article workflow in the current transaction or opens one."
  def transaction(fun) when is_function(fun, 0) do
    if Repo.in_transaction?() do
      {:ok, fun.()}
    else
      Repo.transaction(fun)
    end
  end

  @doc "Publishes one Gate-authorized Article and commits all first-publish side effects atomically."
  def publish(%Article{} = article, %Author{} = author, actor, opts) do
    transaction(fn ->
      with {:ok, identity} <- outbox_identity(opts),
           {:ok, published} <- CMS.Articles.Publish.Target.publish(article, author, opts),
           {:ok, _ticket_cache} <- invalidate_linked_ticket_cache(published, identity),
           {:ok, _finalized} <- finalize_first_publish(published, actor),
           {:ok, _events} <- enqueue_publish_events(published, opts) do
        published
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  defp invalidate_linked_ticket_cache(
         %{article: %Article{thread: :post, id: post_id}},
         identity
       ) do
    CMS.Tickets.SourceVisibility.revalidate_cache_in_transaction(
      post_id,
      identity,
      "post_public_revision_changed:#{post_id}"
    )
  end

  defp invalidate_linked_ticket_cache(_published, _identity), do: {:ok, :pass}

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
         %{
           article: %Article{} = article,
           public: public,
           first_publish?: first_publish?,
           community: %Community{} = community,
           binding: %ArticleBinding{inner_id: inner_id}
         } = result,
         opts
       ) do
    case outbox_identity(opts) do
      {:ok, identity} ->
        with {:ok, cache_event} <-
               Effects.enqueue(
                 if(first_publish?, do: "article.published", else: "article.updated"),
                 "article",
                 article.id,
                 identity,
                 %{
                   community: community.slug,
                   community_id: community.id,
                   thread: article.thread,
                   inner_id: inner_id,
                   article_id: article.id,
                   revision_id: public.revision_id
                 },
                 effect_key: "article-cache:#{community.id}:#{inner_id}",
                 retry_failed: true
               ),
             {:ok, projection_event} <-
               Effects.enqueue(
                 "article.projections",
                 "article",
                 article.id,
                 identity,
                 %{
                   first_publish?: first_publish?,
                   community_id: community.id,
                   inner_id: inner_id,
                   changed_fields: Map.get(result, :changed_fields, []),
                   published_by_id: Map.get(result, :published_by_id),
                   revision_id: public.revision_id
                 },
                 effect_key: "article-projections:#{community.id}:#{inner_id}",
                 retry_failed: true
               ),
             {:ok, mention_event} <-
               capture_article_mentions(article, public, community, identity) do
          {:ok, %{cache: cache_event, projections: projection_event, mentions: mention_event}}
        else
          {:error, reason} -> {:error, reason}
        end

      _ ->
        {:error, CMS.ErrorCat.command_id_required()}
    end
  end

  defp capture_article_mentions(%Article{} = article, public, community, identity) do
    with %ArticleRevision{} = revision <- Repo.get(ArticleRevision, public.revision_id),
         %ArticleBodySnapshot{} = body <- Repo.get(ArticleBodySnapshot, revision.body_snapshot_id),
         {:ok, ast} <- PlateJSON.decode(body.json),
         true <- match?(%DateTime{}, public.updated_at),
         {:ok, captured} <-
           ArtimentMentions.update(
             %{type: article.thread, article_id: article.id},
             %{
               published_revision_identity: "#{public.revision_id}:#{public.publication_version}",
               ast: ast,
               community_id: community.id,
               mentioned_at: public.updated_at
             },
             identity
           ) do
      {:ok, captured}
    else
      nil -> {:error, :source_body_missing}
      false -> {:error, :source_publication_time_missing}
      {:error, _reason} = error -> error
    end
  end

  defp outbox_identity(opts) do
    case Keyword.get(opts, :outbox_command_id) do
      command_id when is_binary(command_id) ->
        case Ecto.UUID.cast(command_id) do
          {:ok, command_id} -> {:ok, {:command, command_id}}
          :error -> {:error, :outbox_command_id_required}
        end

      _ ->
        case Keyword.get(opts, :outbox_workflow_ref) do
          workflow_ref when is_binary(workflow_ref) and workflow_ref != "" ->
            {:ok, {:workflow, workflow_ref}}

          _ ->
            {:error, :outbox_identity_required}
        end
    end
  end

  defp finalize_first_publish(%{first_publish?: false} = result, _actor), do: {:ok, result}

  defp finalize_first_publish(
         %{
           first_publish?: true,
           article: %Article{} = article,
           community: %Community{} = community
         } = result,
         actor
       ) do
    with %User{} = user <- actor_user(actor),
         {:ok, _community} <- CMS.Communities.update_count_field(community, article.thread),
         {:ok, _user} <- Accounts.publish_update_states(user, article.thread),
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
    case RootFrontDesk.fresh_user(user_id) do
      {:ok, %User{} = user} -> user
      _ -> nil
    end
  end
end
