defmodule GroupherServer.CMS.Articles.WorkingCopy.Publisher do
  @moduledoc """
  Applies the internal publication steps after the outer command has authorized the Article.

      authorized Article + WorkingCopy/Snapshot -> validate -> first-publication setup -> Public head
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias GroupherServer.Accounts.Model.User
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
  def publish_in_transaction(
        %Article{thread: thread} = article,
        %Community{} = community,
        source,
        expected_public_snapshot_id,
        %User{} = user,
        command_id
      )
      when thread in @supported_threads and is_binary(command_id) do
    with true <- Repo.in_transaction?(),
         {:ok, :pass} <- MutationLock.lock_community_admission(article.id),
         {:ok, locked_article} <- lock_article(article.id),
         {:ok, %{binding: binding}} <- Bindings.get(locked_article, community),
         {:ok, binding} <- Numbering.assign_binding_inner_id(binding),
         {:ok, lifecycle} <- Lifecycle.lock(locked_article),
         {:ok, source_work, source_ref} <- resolve_source(locked_article, source),
         {:ok, public} <- lock_public(locked_article.id),
         {:ok, :pass} <- ensure_public_head(public, expected_public_snapshot_id),
         {:ok, snapshot} <-
           materialize_source(locked_article, source_work, source_ref, user, command_id),
         first_publish? <- is_nil(public),
         {:ok, :pass} <- check_first_publish_rate_limit(user, first_publish?),
         {:ok, :pass} <- Publishable.validate(snapshot),
         {:ok, published_at} <- published_at(),
         {:ok, locked_article} <- ensure_active_at(locked_article, published_at),
         {:ok, selected} <-
           Public.select_snapshot(locked_article, snapshot, user, published_at: published_at),
         {:ok, _edited_article} <- mark_edited_on_republish(locked_article, public, snapshot),
         {:ok, _linked_tickets} <-
           revalidate_linked_tickets(locked_article, snapshot, command_id),
         {:ok, _mentions} <-
           capture_mentions(locked_article, community, snapshot, selected, command_id),
         {:ok, _stats} <- maybe_initialize_stats(locked_article, first_publish?),
         {:ok, lifecycle} <- transition_lifecycle(lifecycle),
         {:ok, _review} <- register_review(locked_article, snapshot, lifecycle, first_publish?),
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
             command_id
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

  def publish_in_transaction(_article, _community, _source, _expected, _user, _command_id),
    do: {:error, :unsupported_article_thread}

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

  defp resolve_source(_article, _source),
    do: {:error, :invalid_publish_source}

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

  defp published_at, do: {:ok, DateTime.utc_now(:second)}

  defp ensure_active_at(%Article{active_at: %DateTime{}} = article, _published_at),
    do: {:ok, article}

  defp ensure_active_at(%Article{} = article, published_at),
    do: article |> Article.changeset(%{active_at: published_at}) |> Repo.update()

  defp maybe_initialize_stats(article, true), do: CMS.ArticleStats.initialize(article)
  defp maybe_initialize_stats(_article, false), do: {:ok, :unchanged}

  defp mark_edited_on_republish(%Article{} = article, nil, _snapshot), do: {:ok, article}

  defp mark_edited_on_republish(%Article{is_edited: true} = article, _public, _snapshot),
    do: {:ok, article}

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

  defp revalidate_linked_tickets(%Article{thread: :post, id: post_id}, snapshot, command_id) do
    CMS.Tickets.SourceVisibility.revalidate_cache_in_transaction(
      post_id,
      {:command, command_id},
      "post-snapshot:#{snapshot.id}"
    )
  end

  defp revalidate_linked_tickets(%Article{}, _snapshot, _command_id), do: {:ok, :pass}

  defp transition_lifecycle(%ArticleLifecycle{state: :published} = lifecycle),
    do: {:ok, lifecycle}

  defp transition_lifecycle(%ArticleLifecycle{} = lifecycle),
    do: Lifecycle.transition(lifecycle, :published)

  defp register_review(article, snapshot, lifecycle, first_publish?) do
    community_ids =
      ArticleBinding
      |> where([binding], binding.article_id == ^article.id)
      |> select([binding], binding.community_id)
      |> Repo.all()

    with {:ok, configs} <- GroupherServer.ReviewBot.configs_for_targets(community_ids, :article),
         target <- %{type: :article, article_id: article.id, lifecycle: lifecycle},
         content <- %{
           identity: "article-snapshot:#{snapshot.id}",
           title: snapshot.title,
           body: snapshot.body_plain_text || "",
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

  defp enqueue_events(article, community, binding, public, snapshot, first_publish?, command_id) do
    identity = {:command, command_id}

    with {:ok, cache_event} <-
           CMS.Articles.Effects.enqueue(
             if(first_publish?, do: "article.published", else: "article.updated"),
             "article",
             article.id,
             identity,
             %{
               community: community.slug,
               community_id: community.id,
               thread: article.thread,
               inner_id: binding.inner_id,
               article_id: article.id,
               snapshot_id: snapshot.id
             },
             effect_key: "article-cache:#{community.id}:#{binding.inner_id}",
             retry_failed: true
           ),
         {:ok, projection_event} <-
           CMS.Articles.Effects.enqueue(
             "article.projections",
             "article",
             article.id,
             identity,
             %{
               first_publish?: first_publish?,
               community_id: community.id,
               inner_id: binding.inner_id,
               published_by_id: public.published_by_id,
               snapshot_id: snapshot.id
             },
             effect_key: "article-projections:#{community.id}:#{binding.inner_id}",
             retry_failed: true
           ) do
      {:ok, %{cache: cache_event, projections: projection_event}}
    end
  end

  defp capture_mentions(article, community, snapshot, public, command_id) do
    with {:ok, ast} <- PlateJSON.decode(snapshot.body_json),
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
             {:command, command_id}
           ) do
      {:ok, captured}
    else
      false -> {:error, :source_publication_time_missing}
      {:error, _reason} = error -> error
    end
  end
end
