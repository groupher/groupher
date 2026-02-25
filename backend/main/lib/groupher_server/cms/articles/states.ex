defmodule GroupherServer.CMS.Articles.States do
  @moduledoc """
  Article state helpers.
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Helper.Matcher
  import Helper.ErrorCode
  import Helper.Utils, only: [done: 1, get_config: 2]

  alias GroupherServer.{CMS, Repo}

  alias CMS.Comments.Write
  alias CMS.Helper.ArticleEnums
  alias CMS.Model.{Community, Embeds, PinnedArticle, Post}
  alias CMS.{Communities, FrontDesk}

  alias Ecto.Multi
  alias Helper.{ORM, Transaction}
  alias Helper.Types, as: T

  @active_period get_config(:article, :active_period_days)
  @archive_threshold get_config(:article, :archive_threshold)
  @article_cat ArticleEnums.cat_values() |> Enum.into(%{}, &{&1, &1})

  @max_pinned_article_count_per_thread Community.max_pinned_article_count_per_thread()

  @spec set_cat(Post.t(), term()) :: T.domain_res(term())
  def set_cat(%Post{} = post, cat) do
    with {:ok, updated} <- ORM.update(post, %{cat: cat}),
         {:ok, _} <- Write.batch_update_question_flag(post, cat == @article_cat.question) do
      updated |> done
    end
  end

  @spec set_state(Post.t(), term()) :: T.domain_res(term())
  def set_state(%Post{} = post, state) do
    with {:ok, updated} <- ORM.update(post, %{state: state}) do
      updated |> done
    end
  end

  @spec update_active_timestamp(atom(), term()) :: T.domain_res(term())
  def update_active_timestamp(thread, article) do
    case in_active_period?(thread, article) do
      true -> ORM.update(article, %{active_at: DateTime.utc_now()})
      _ -> {:ok, :pass}
    end
  end

  @spec update_edit_status(term()) :: T.domain_res(term())
  def update_edit_status(%{meta: %Embeds.ArticleMeta{} = meta} = content) do
    meta = meta |> Map.merge(%{is_edited: true})
    ORM.update_meta(content, meta)
  end

  def update_edit_status(%{meta: nil} = content) do
    meta = Embeds.ArticleMeta.default_meta() |> Map.merge(%{is_edited: true})
    ORM.update_meta(content, meta)
  end

  def update_edit_status(content), do: {:ok, content}

  @spec archive(atom()) :: T.domain_res(term())
  def archive(thread) do
    with {:ok, info} <- match(thread) do
      now = Timex.now()
      threshold = @archive_threshold[thread] || @archive_threshold[:default]
      archive_threshold = Timex.shift(now, threshold)

      info.model
      |> where([article], article.inserted_at < ^archive_threshold)
      |> Repo.update_all(set: [is_archived: true, archived_at: now])
      |> done()
    end
  end

  @spec sink(term()) :: T.domain_res(term())
  def sink(article) do
    %{inserted_at: inserted_at} = article

    case ORM.update_meta(article, %{
           is_sunk: true,
           last_active_at: inserted_at
         }) do
      {:ok, article} ->
        ORM.update(article, %{active_at: inserted_at})

      {:error, reason} ->
        {:error, reason}
    end
  end

  @spec undo_sink(term()) :: T.domain_res(term())
  def undo_sink(article) do
    {:ok, thread} = FrontDesk.thread_of(article)

    with true <- in_active_period?(thread, article),
         {:ok, article} <- ORM.update_meta(article, %{is_sunk: false}) do
      ORM.update(article, %{active_at: article.meta.last_active_at})
    else
      false -> raise_error(:undo_sink_old_article, "can not undo sink old article")
    end
  end

  @spec lock_comments(term()) :: T.domain_res(term())
  def lock_comments(article) do
    Transaction.locking(article, fn article ->
      ORM.update_meta(article, %{is_comment_locked: true})
    end)
  end

  @spec undo_lock_comments(term()) :: T.domain_res(term())
  def undo_lock_comments(article) do
    Transaction.locking(article, fn article ->
      ORM.update_meta(article, %{is_comment_locked: false})
    end)
  end

  @spec pin(Community.t(), T.article()) :: T.domain_res(T.article())
  def pin(%Community{} = community, article) do
    with {:ok, thread} <- FrontDesk.thread_of(article),
         args <- pack_pin_args(community, thread, article.id),
         {:ok, _} <- check_pinned_article_count(community, thread),
         {:ok, _} <- ORM.create(PinnedArticle, args) do
      {:ok, article}
    end
  end

  @spec undo_pin(Community.t(), T.article()) :: T.domain_res(T.article())
  def undo_pin(%Community{} = community, article) do
    with {:ok, thread} <- FrontDesk.thread_of(article),
         args <- pack_pin_args(community, thread, article.id),
         {:ok, _} <- ORM.findby_delete(PinnedArticle, args) do
      {:ok, article}
    end
  end

  @spec mirror(Community.t(), T.article()) :: T.domain_res(T.article())
  @spec mirror(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def mirror(%Community{} = target_community, article, community_tag_ids \\ []) do
    article = Repo.preload(article, :communities)

    with {:ok, thread} <- FrontDesk.thread_of(article) do
      communities =
        (article.communities ++ [target_community])
        |> Enum.uniq_by(& &1.id)

      Multi.new()
      |> Multi.run(:mirror_target_community, fn _, _ ->
        article
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_assoc(:communities, communities)
        |> Repo.update()
      end)
      |> Multi.run(:set_target_tags, fn _, %{mirror_target_community: article} ->
        Communities.set_tags(target_community, thread, article, %{
          community_tags: community_tag_ids
        })
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @spec unmirror(Community.t(), T.article()) :: T.domain_res(T.article())
  def unmirror(%Community{} = target_community, article) do
    article = Repo.preload(article, [:communities, :community, :community_tags])

    case article.community.id == target_community.id do
      true ->
        raise_error(:mirror_article, "can not unmirror original community")

      false ->
        community_tags = tags_without_community(article, target_community)

        article
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_assoc(
          :communities,
          Enum.reject(article.communities, &(&1.slug == target_community.slug))
        )
        |> Ecto.Changeset.put_assoc(:community_tags, community_tags)
        |> Repo.update()
    end
  end

  @spec move(Community.t(), T.article()) :: T.domain_res(T.article())
  @spec move(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def move(%Community{} = target_community, article, community_tag_ids \\ []) do
    article = Repo.preload(article, [:communities, :community, :community_tags])

    with {:ok, thread} <- FrontDesk.thread_of(article) do
      original_community = article.community

      Multi.new()
      |> Multi.run(:move_article, fn _, _ ->
        communities =
          (article.communities -- [original_community])
          |> Kernel.++([target_community])
          |> Enum.uniq_by(& &1.id)

        community_tags = tags_without_community(article, original_community)

        article
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_change(:community_id, target_community.id)
        |> Ecto.Changeset.put_assoc(:communities, communities)
        |> Ecto.Changeset.put_assoc(:community_tags, community_tags)
        |> Repo.update()
      end)
      |> Multi.run(:set_target_tags, fn _, %{move_article: article} ->
        Communities.set_tags(target_community, thread, article, %{
          community_tags: community_tag_ids
        })
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @spec mirror_to_home(Community.t(), T.article()) :: T.domain_res(T.article())
  @spec mirror_to_home(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def mirror_to_home(%Community{} = home_community, article, community_tag_ids \\ []) do
    article = Repo.preload(article, [:communities, :community_tags])

    with {:ok, thread} <- FrontDesk.thread_of(article) do
      communities =
        (article.communities ++ [home_community])
        |> Enum.uniq_by(& &1.id)

      Multi.new()
      |> Multi.run(:set_community, fn _, _ ->
        article
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_assoc(:communities, communities)
        |> Repo.update()
      end)
      |> Multi.run(:set_target_tags, fn _, %{set_community: article} ->
        Communities.set_tags(home_community, thread, article, %{
          community_tags: community_tag_ids
        })
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @spec move_to_blackhole(Community.t(), T.article()) :: T.domain_res(T.article())
  @spec move_to_blackhole(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def move_to_blackhole(%Community{} = blackhole, article, community_tag_ids \\ []) do
    article = Repo.preload(article, [:communities, :community, :community_tags])

    with {:ok, thread} <- FrontDesk.thread_of(article) do
      Multi.new()
      |> Multi.run(:set_community, fn _, _ ->
        article
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.put_change(:community_id, blackhole.id)
        |> Ecto.Changeset.put_assoc(:communities, [blackhole])
        |> Ecto.Changeset.put_assoc(:community_tags, [])
        |> Repo.update()
      end)
      |> Multi.run(:set_target_tags, fn _, %{set_community: article} ->
        Communities.set_tags(blackhole, thread, article, %{
          community_tags: community_tag_ids
        })
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  defp in_active_period?(thread, article) do
    active_period_days = @active_period[thread] || @active_period[:default]

    inserted_at = article.inserted_at
    active_threshold = Timex.shift(Timex.now(), days: -active_period_days)

    :gt == DateTime.compare(inserted_at, active_threshold)
  end

  defp pack_pin_args(%Community{} = community, thread, article_id) do
    with {:ok, info} <- match(thread) do
      thread = thread |> to_string() |> String.upcase()

      Map.put(
        %{community_id: community.id, thread: thread},
        info.foreign_key,
        article_id
      )
    end
  end

  defp check_pinned_article_count(%Community{} = community, thread) do
    thread = thread |> to_string() |> String.upcase()

    query =
      from(p in PinnedArticle, where: p.community_id == ^community.id and p.thread == ^thread)

    pinned_articles = query |> Repo.all()

    case length(pinned_articles) >= @max_pinned_article_count_per_thread do
      true -> raise_error(:too_much_pinned_article, "too much pinned article")
      _ -> {:ok, :pass}
    end
  end

  defp tags_without_community(article, %Community{id: community_id}) do
    %{community_tags: community_tags} = article
    community_tags -- Enum.filter(community_tags, &(&1.community_id === community_id))
  end

  defp result({:ok, %{set_target_tags: result}}), do: result |> done()
  defp result({:ok, %{mirror_target_community: result}}), do: result |> done()
  defp result({:error, _, result, _steps}), do: {:error, result}
end
