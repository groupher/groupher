defmodule GroupherServer.CMS.Articles.WorkingCopy.Publisher do
  @moduledoc """
  Applies the internal publication steps after the outer command has authorized the Article.

      authorized Article + WorkingCopy/Snapshot -> validate -> first-publication setup -> Public head
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Accounts, Activity, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.{Bindings, Lifecycle, MutationLock, Numbering, Publishable, Public}
  alias CMS.Artiment.PlateJSON
  alias CMS.ArtimentMentions
  alias CMS.Articles.WorkingCopy.Snapshotter

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleLifecycle,
    ArticlePublic,
    ArticleSnapshot,
    ArticleWorkingCopy,
    Community,
    CommunityAsset,
    ArticleAssetRef
  }

  @supported_threads [:post, :blog, :changelog]

  @doc "Publishes a saved WorkingCopy revision or existing Snapshot in the caller transaction."
  def publish_in_transaction(article, community, source, expected, user, operation_ref) do
    publish_in_transaction(
      article,
      community,
      source,
      expected,
      user,
      operation_ref,
      nil
    )
  end

  def publish_in_transaction(
        %Article{thread: thread} = article,
        %Community{} = community,
        source,
        expected_public_snapshot_id,
        %User{} = user,
        operation_ref,
        causation_command_id
      )
      when thread in @supported_threads and is_binary(operation_ref) do
    with true <- Repo.in_transaction?(),
         {:ok, :pass} <- MutationLock.lock_community_admission(article.id),
         {:ok, locked_article} <- lock_article(article.id),
         {:ok, %{binding: binding}} <- Bindings.get(locked_article, community),
         {:ok, binding} <- Numbering.assign_binding_inner_id(binding),
         {:ok, lifecycle} <- Lifecycle.lock(locked_article),
         {:ok, source_work, source_ref} <- resolve_source(locked_article, source),
         {:ok, public} <- lock_public(locked_article.id),
         {:ok, :pass} <- ensure_public_head(public, expected_public_snapshot_id),
         {:ok, previous_snapshot} <- previous_snapshot(public),
         {:ok, snapshot} <-
           materialize_source(locked_article, source_work, source_ref, user, causation_command_id),
         first_publish? <- is_nil(lifecycle.first_published_at),
         {:ok, :pass} <- check_first_publish_rate_limit(user, first_publish?),
         {:ok, :pass} <- Publishable.validate(snapshot),
         {:ok, published_at} <- published_at(),
         {:ok, locked_article} <- ensure_active_at(locked_article, published_at),
         {:ok, selected} <-
           Public.select_snapshot(locked_article, snapshot, user, published_at: published_at),
         {:ok, _edited_article} <- mark_edited_on_republish(locked_article, public, snapshot),
         {:ok, _linked_tickets} <-
           revalidate_linked_tickets(locked_article, snapshot, operation_ref),
         {:ok, _mentions} <-
           capture_mentions(locked_article, community, snapshot, selected, operation_ref),
         {:ok, _stats} <- maybe_initialize_stats(locked_article, first_publish?),
         {:ok, lifecycle} <- transition_lifecycle(lifecycle),
         {:ok, _review} <-
           register_review(locked_article, snapshot, lifecycle, first_publish?, operation_ref),
         {:ok, _activity} <-
           record_publication_changes(
             locked_article,
             community,
             binding,
             previous_snapshot,
             snapshot,
             user,
             operation_ref,
             first_publish?
           ),
         {:ok, _binding} <- CMS.Articles.BindingPersist.ensure_binding(locked_article, community),
         {:ok, _finalized} <-
           maybe_finalize_first_publish(user, locked_article, community, first_publish?),
         {:ok, _events} <-
           enqueue_events(
             locked_article,
             community,
             binding,
             selected,
             snapshot,
             first_publish?,
             operation_ref
           ) do
      {:ok,
       %{
         article: locked_article,
         community: community,
         binding: binding,
         public: selected,
         snapshot: snapshot,
         working_copy: source_work,
         actor: user,
         first_publish?: first_publish?,
         published_by_id: user.id
       }}
    else
      false -> {:error, :transaction_required}
      {:error, _reason} = error -> error
    end
  end

  def publish_in_transaction(
        _article,
        _community,
        _source,
        _expected,
        _user,
        _operation_ref,
        _causation_command_id
      ) do
    {:error, :unsupported_article_thread}
  end

  defp resolve_source(article, %{working_copy_id: id, revision: revision})
       when is_binary(id) and is_integer(revision) do
    case Repo.one(
           from(work in ArticleWorkingCopy,
             where: work.id == ^id and work.article_id == ^article.id,
             lock: "FOR UPDATE"
           )
         ) do
      %ArticleWorkingCopy{revision: ^revision} = work ->
        with {:ok, :pass} <- Publishable.validate(work) do
          {:ok, work, {:working_copy, work}}
        end

      %ArticleWorkingCopy{} ->
        {:error, :revision_conflict}

      nil ->
        {:error, :working_copy_not_found}
    end
  end

  defp resolve_source(article, %{snapshot_id: id}) when is_binary(id) do
    case Repo.get(ArticleSnapshot, id) do
      %ArticleSnapshot{article_id: article_id} when article_id == article.id ->
        {:ok, nil, {:snapshot, id}}

      %ArticleSnapshot{} ->
        {:error, :snapshot_owner_mismatch}

      nil ->
        {:error, :snapshot_not_found}
    end
  end

  defp resolve_source(_article, _source) do
    {:error, :invalid_publish_source}
  end

  defp materialize_source(
         article,
         %ArticleWorkingCopy{} = work,
         {:working_copy, work},
         user,
         command_id
       ) do
    Snapshotter.freeze_locked(article, work, user, command_id)
  end

  defp materialize_source(article, nil, {:snapshot, id}, _user, _command_id) do
    case Repo.one(
           from(snapshot in ArticleSnapshot,
             where: snapshot.id == ^id and snapshot.article_id == ^article.id,
             lock: "FOR UPDATE"
           )
         ) do
      %ArticleSnapshot{} = snapshot -> {:ok, snapshot}
      nil -> {:error, :snapshot_owner_mismatch}
    end
  end

  defp lock_article(id) do
    case Repo.one(from(article in Article, where: article.id == ^id, lock: "FOR UPDATE")) do
      %Article{} = article -> {:ok, article}
      nil -> {:error, :article_not_found}
    end
  end

  defp lock_public(article_id) do
    case Repo.one(
           from(public in ArticlePublic,
             where: public.article_id == ^article_id,
             lock: "FOR UPDATE"
           )
         ) do
      %ArticlePublic{} = public -> {:ok, public}
      nil -> {:ok, nil}
    end
  end

  defp ensure_public_head(nil, nil), do: {:ok, :pass}
  defp ensure_public_head(%ArticlePublic{snapshot_id: id}, id), do: {:ok, :pass}
  defp ensure_public_head(_public, _expected), do: {:error, :public_conflict}

  defp previous_snapshot(nil), do: {:ok, nil}

  defp previous_snapshot(%ArticlePublic{snapshot_id: id}) do
    case Repo.get(ArticleSnapshot, id) do
      %ArticleSnapshot{} = snapshot -> {:ok, snapshot}
      nil -> {:error, :article_snapshot_projection_missing}
    end
  end

  defp record_publication_changes(
         article,
         community,
         binding,
         nil,
         snapshot,
         user,
         operation_ref,
         true
       ) do
    Activity.log(activity_resource(article, community, binding, snapshot), :created,
      actor: user,
      operation_ref: operation_ref,
      metadata: %{snapshot_id: snapshot.id}
    )
  end

  defp record_publication_changes(
         _article,
         _community,
         _binding,
         nil,
         _snapshot,
         _user,
         _ref,
         false
       ) do
    {:ok, :unchanged}
  end

  defp record_publication_changes(
         article,
         community,
         binding,
         previous,
         snapshot,
         user,
         operation_ref,
         _first_publish?
       ) do
    resource = activity_resource(article, community, binding, snapshot)

    metadata = %{snapshot_id: snapshot.id}

    with {:ok, _} <-
           maybe_log_change(
             previous.title != snapshot.title,
             resource,
             :title_changed,
             user,
             operation_ref,
             metadata,
             %{title: snapshot.title},
             [:title]
           ),
         {:ok, _} <-
           maybe_log_change(
             CMS.Articles.Body.document(previous).json !=
               CMS.Articles.Body.document(snapshot).json,
             resource,
             :body_updated,
             user,
             operation_ref,
             metadata,
             %{schema_version: CMS.Articles.Body.document(snapshot).schema_version},
             [:body]
           ) do
      {:ok, :pass}
    end
  end

  defp activity_resource(article, community, binding, snapshot) do
    %{
      article_id: article.id,
      thread: article.thread,
      community_id: community.id,
      inner_id: binding.inner_id,
      title: snapshot.title
    }
  end

  defp maybe_log_change(
         false,
         _resource,
         _action,
         _user,
         _operation_ref,
         _metadata,
         _payload,
         _fields
       ) do
    {:ok, :unchanged}
  end

  defp maybe_log_change(true, resource, action, user, operation_ref, metadata, payload, fields) do
    Activity.log(resource, action,
      actor: user,
      operation_ref: operation_ref,
      operation_index: if(action == :title_changed, do: 0, else: 1),
      metadata: metadata,
      payload: payload,
      changed_fields: fields
    )
  end

  defp published_at, do: {:ok, DateTime.utc_now(:second)}

  defp ensure_active_at(%Article{active_at: %DateTime{}} = article, _published_at) do
    {:ok, article}
  end

  defp ensure_active_at(%Article{} = article, published_at) do
    article |> Article.changeset(%{active_at: published_at}) |> Repo.update()
  end

  defp maybe_initialize_stats(article, true), do: CMS.ArticleStats.initialize(article)
  defp maybe_initialize_stats(_article, false), do: {:ok, :unchanged}

  defp mark_edited_on_republish(%Article{} = article, nil, _snapshot), do: {:ok, article}

  defp mark_edited_on_republish(%Article{is_edited: true} = article, _public, _snapshot) do
    {:ok, article}
  end

  defp mark_edited_on_republish(
         %Article{} = article,
         %ArticlePublic{snapshot_id: public_snapshot_id},
         %ArticleSnapshot{id: snapshot_id}
       )
       when public_snapshot_id != snapshot_id do
    article
    |> Article.changeset(%{is_edited: true})
    |> Repo.update()
  end

  defp mark_edited_on_republish(%Article{} = article, _public, _snapshot), do: {:ok, article}

  defp revalidate_linked_tickets(%Article{thread: :post, id: post_id}, _snapshot, operation_ref) do
    CMS.Tickets.SourceVisibility.revalidate_cache_in_transaction(
      post_id,
      operation_ref
    )
  end

  defp revalidate_linked_tickets(%Article{}, _snapshot, _operation_ref), do: {:ok, :pass}

  defp transition_lifecycle(%ArticleLifecycle{state: :published} = lifecycle) do
    {:ok, lifecycle}
  end

  defp transition_lifecycle(%ArticleLifecycle{} = lifecycle) do
    Lifecycle.transition(lifecycle, :published)
  end

  defp register_review(article, snapshot, lifecycle, first_publish?, operation_ref) do
    community_ids =
      ArticleBinding
      |> where([binding], binding.article_id == ^article.id)
      |> select([binding], binding.community_id)
      |> Repo.all()

    with {:ok, configs} <- GroupherServer.ReviewBot.configs_for_targets(community_ids, :article),
         target <- %{
           type: :article,
           article_id: article.id,
           lifecycle: lifecycle,
           operation_ref: operation_ref
         },
         content <- %{
           identity: "article-snapshot:#{snapshot.id}",
           title: snapshot.title,
           body: CMS.Articles.Body.document(snapshot).plain_text || "",
           images: review_images(snapshot.id)
         } do
      GroupherServer.CMS.Review.RequestSubmission.register_in_transaction(
        target,
        content,
        configs,
        if(first_publish?, do: :publish, else: :edit)
      )
    end
  end

  defp review_images(snapshot_id) do
    ArticleAssetRef
    |> join(:inner, [ref], asset in CommunityAsset, on: asset.id == ref.asset_id)
    |> where(
      [ref, asset],
      ref.snapshot_id == ^snapshot_id and ref.usage in [:inline, :cover, :cover_dark] and
        asset.asset_type == :image
    )
    |> order_by([ref, _asset], asc: ref.position, asc: ref.id)
    |> select([ref, asset], %{
      asset_id: ref.asset_id,
      immutable_version: fragment("COALESCE(?, ?)", asset.content_hash, asset.url_hash)
    })
    |> Repo.all()
  end

  defp maybe_finalize_first_publish(user, article, community, first_publish?) do
    if first_publish? do
      with {:ok, _throttle} <- CMS.Gate.RateLimit.Publish.record(user),
           {:ok, _community} <- CMS.Communities.update_count_field(community, article.thread),
           {:ok, _user} <- Accounts.publish_update_states(user, article.thread) do
        {:ok, :pass}
      end
    else
      {:ok, :pass}
    end
  end

  defp check_first_publish_rate_limit(_user, false), do: {:ok, :pass}

  defp check_first_publish_rate_limit(user, true) do
    case CMS.Gate.RateLimit.Publish.check_in_transaction(user) do
      {:ok, _admission} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp enqueue_events(
         article,
         community,
         binding,
         public,
         snapshot,
         first_publish?,
         operation_ref
       ) do
    with {:ok, cache_event} <-
           enqueue_publication(binding, community, snapshot, first_publish?, operation_ref),
         {:ok, projection_event} <-
           CMS.Articles.Effects.projections_selected(
             binding,
             public,
             first_publish?,
             operation_ref
           ),
         {:ok, notification_event} <-
           maybe_enqueue_first_publish_notification(
             article,
             community,
             snapshot,
             public.published_by_id,
             first_publish?,
             operation_ref
           ) do
      {:ok,
       %{cache: cache_event, projections: projection_event, notification: notification_event}}
    end
  end

  defp enqueue_publication(binding, community, snapshot, true, operation_ref) do
    CMS.Articles.Effects.published(binding, community, snapshot, operation_ref)
  end

  defp enqueue_publication(binding, community, snapshot, false, operation_ref) do
    CMS.Articles.Effects.updated(binding, community, snapshot, operation_ref)
  end

  defp maybe_enqueue_first_publish_notification(
         article,
         community,
         snapshot,
         published_by_id,
         true,
         operation_ref
       ) do
    CMS.Articles.Effects.enqueue_first_publish_notification(
      article,
      community,
      snapshot,
      published_by_id,
      operation_ref
    )
  end

  defp maybe_enqueue_first_publish_notification(
         _article,
         _community,
         _snapshot,
         _published_by_id,
         false,
         _operation_ref
       ) do
    {:ok, :unchanged}
  end

  defp capture_mentions(article, community, snapshot, public, operation_ref) do
    with {:ok, ast} <- PlateJSON.decode(CMS.Articles.Body.document(snapshot).json),
         true <- match?(%DateTime{}, public.updated_at),
         {:ok, captured} <-
           ArtimentMentions.update(
             %{type: article.thread, article_id: article.id},
             %{
               published_revision_identity: "article-snapshot:#{snapshot.id}",
               ast: ast,
               community_id: community.id,
               mentioned_at: public.updated_at
             },
             operation_ref
           ) do
      {:ok, captured}
    else
      false -> {:error, :source_publication_time_missing}
      {:error, _reason} = error -> error
    end
  end
end
