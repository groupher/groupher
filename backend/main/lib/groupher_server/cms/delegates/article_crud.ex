defmodule GroupherServer.CMS.Delegate.ArticleCRUD do
  @moduledoc """
  CRUD operation on post/job ...
  """
  import Ecto.Query, warn: false

  import GroupherServer.CMS.Helper.Matcher

  import Helper.Utils,
    only: [
      done: 1,
      pick_by: 2,
      plural: 1,
      module_to_atom: 1,
      get_config: 2,
      module_to_upcase: 1,
      atom_values_to_upcase: 1,
      mark_viewer_emotion_states: 2,
      thread_of: 1
    ]

  import ShortMaps
  import Helper.ErrorCode

  alias GroupherServer.FrontDesk
  alias Helper.{Later, ORM, QueryBuilder, Converter, Constant, Transaction}
  alias Helper.Types, as: T
  alias GroupherServer.{Accounts, CMS, Email, Repo, Statistics}

  alias Accounts.Model.User
  alias CMS.Model.{Author, Community, PinnedArticle, Embeds, Post}

  alias CMS.Delegate.{
    ArticleCommunity,
    CommentCRUD,
    ArticleTag,
    CommunityCRUD,
    Document,
    Hooks
  }

  alias Ecto.Multi

  @active_period get_config(:article, :active_period_days)
  @archive_threshold get_config(:article, :archive_threshold)
  @article_threads get_config(:article, :threads)

  @default_emotions Embeds.ArticleEmotion.default_emotions()
  @default_article_meta Embeds.ArticleMeta.default_meta()
  @remove_article_hint "The content does not comply with the community norms"

  @audit_legal Constant.CMS.pending(:legal)
  @audit_illegal Constant.CMS.pending(:illegal)
  @audit_failed Constant.CMS.pending(:audit_failed)

  @article_cat Constant.CMS.article_cat()
  @article_state Constant.CMS.article_state()

  @doc """
  read articles for un-logged user
  """
  @spec read_article(String.t(), atom(), T.id()) :: T.domain_res(term())
  def read_article(community_slug, thread, inner_id) when thread in @article_threads do
    with {:ok, article} <- if_article_legal(community_slug, thread, inner_id) do
      do_read_article(article, community_slug, thread)
    end
  end

  def read_article(community_slug, thread, inner_id, %User{id: user_id} = user)
      when thread in @article_threads do
    with {:ok, article} <- if_article_legal(community_slug, thread, inner_id, user) do
      Multi.new()
      |> Multi.run(:normal_read, fn _, _ -> do_read_article(article, community_slug, thread) end)
      |> Multi.run(:add_viewed_user, fn _, %{normal_read: article} ->
        update_viewed_user_list(article, user_id)
      end)
      |> Multi.run(:set_viewer_has_states, fn _, %{normal_read: article} ->
        article = Repo.preload(article, :community)

        viewer_has_states = %{
          viewer_has_collected: user_id in article.meta.collected_user_ids,
          viewer_has_upvoted: user_id in article.meta.upvoted_user_ids,
          viewer_has_reported: user_id in article.meta.reported_user_ids
        }

        article
        |> Map.merge(viewer_has_states)
        |> covert_cat_state_ifneed()
        |> done
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  def convert_paged_cat_state_if_need(%{entries: []} = paged_posts), do: paged_posts

  def convert_paged_cat_state_if_need(%{entries: entries} = paged_posts) do
    cooked_entries = Enum.map(entries, &covert_cat_state_ifneed/1)

    paged_posts |> Map.merge(%{entries: cooked_entries})
  end

  defp covert_cat_state_ifneed(%Post{cat: cat, state: state} = article)
       when is_nil(cat) and is_nil(state) do
    article
  end

  defp covert_cat_state_ifneed(%Post{cat: cat, state: state} = article) when is_nil(state) do
    cat_value = Constant.CMS.article_cat_value(cat)
    article |> Map.merge(%{cat: cat_value})
  end

  defp covert_cat_state_ifneed(%Post{cat: cat, state: state} = article) when is_nil(cat) do
    state_value = Constant.CMS.article_state_value(state)
    article |> Map.merge(%{state: state_value})
  end

  defp covert_cat_state_ifneed(%Post{cat: cat, state: state} = article) do
    cat_value = Constant.CMS.article_cat_value(cat)
    state_value = Constant.CMS.article_state_value(state)

    article |> Map.merge(%{cat: cat_value, state: state_value})
  end

  defp covert_cat_state_ifneed(article), do: article

  @doc """
  get paged articles
  """
  @spec paged_articles(atom(), map()) :: T.domain_res(term())
  def paged_articles(thread, filter) do
    %{page: page, size: size} = filter
    flags = %{mark_delete: false, pending: :legal}

    with {:ok, info} <- match(thread) do
      info.model
      |> QueryBuilder.domain_query(filter)
      |> QueryBuilder.filter_pack(Map.merge(filter, flags))
      |> ORM.paginator(~m(page size)a)
      # |> ORM.cursor_paginator()
      |> add_pin_articles_ifneed(info.model, filter)
      |> convert_paged_cat_state_if_need()
      |> done()
    end
  end

  @spec paged_articles(atom(), map(), User.t()) :: T.domain_res(term())
  def paged_articles(thread, filter, %User{} = user) do
    with {:ok, stateless_paged_articles} <- paged_articles(thread, filter) do
      stateless_paged_articles
      |> mark_viewer_emotion_states(user)
      |> mark_viewer_has_states(user)
      |> done()
    end
  end

  @doc """
  get grouped kanban posts for a community, only for first load of kanban page
  """
  @spec grouped_kanban_posts(Community.t()) :: T.domain_res(term())
  def grouped_kanban_posts(%Community{} = community) do
    filter = %{page: 1, size: 20}

    with {:ok, paged_todo} <-
           paged_kanban_posts(community, Map.merge(filter, %{state: @article_state.todo})),
         {:ok, paged_wip} <-
           paged_kanban_posts(community, Map.merge(filter, %{state: @article_state.wip})),
         {:ok, paged_done} <-
           paged_kanban_posts(community, Map.merge(filter, %{state: @article_state.done})) do
      %{
        todo: paged_todo,
        wip: paged_wip,
        done: paged_done
      }
      |> done
    end
  end

  @spec paged_kanban_posts(Community.t(), map()) :: T.domain_res(term())
  def paged_kanban_posts(%Community{} = community, %{state: state} = filter)
      when is_binary(state) do
    state_key = state |> String.downcase() |> String.to_atom()
    state = @article_state |> Map.get(state_key)
    filter = filter |> Map.merge(%{state: state})

    paged_kanban_posts(community, filter)
  end

  def paged_kanban_posts(%Community{} = community, filter) do
    %{page: page, size: size, state: state} = filter

    flags = %{
      mark_delete: false,
      pending: :legal,
      community_id: community.id,
      state: state
    }

    Post
    |> QueryBuilder.filter_pack(Map.merge(filter, flags))
    |> ORM.paginator(~m(page size)a)
    |> convert_paged_cat_state_if_need()
    |> done()
  end

  @doc "paged published articles for accounts"
  @spec paged_published_articles(atom(), map(), T.id()) :: T.domain_res(term())
  def paged_published_articles(thread, filter, user_id) do
    %{page: page, size: size} = filter

    with {:ok, info} <- match(thread),
         {:ok, user} <- ORM.find(User, user_id) do
      info.model
      |> join(:inner, [article], author in assoc(article, :author))
      |> where([article, author], author.user_id == ^user.id)
      |> select([article, author], article)
      |> QueryBuilder.filter_pack(filter)
      |> ORM.paginator(~m(page size)a)
      |> mark_viewer_emotion_states(user)
      |> mark_viewer_has_states(user)
      |> done()
    end
  end

  # get audit failed articles
  @spec paged_audit_failed_articles(atom(), map()) :: T.domain_res(term())
  def paged_audit_failed_articles(thread, filter) do
    %{page: page, size: size} = filter
    flags = %{mark_delete: false, pending: :audit_failed}

    with {:ok, info} <- match(thread) do
      info.model
      |> QueryBuilder.filter_pack(Map.merge(filter, flags))
      |> ORM.paginator(~m(page size)a)
      |> done()
    end
  end

  @spec set_post_cat(Post.t(), term()) :: T.domain_res(term())
  def set_post_cat(%Post{} = post, cat) do
    with {:ok, updated} <- ORM.update(post, %{cat: cat}) do
      CommentCRUD.batch_update_question_flag(post, cat == @article_cat.question)

      updated |> covert_cat_state_ifneed |> done
    end
  end

  @spec set_post_state(Post.t(), term()) :: T.domain_res(term())
  def set_post_state(%Post{} = post, state) do
    with {:ok, updated} <- ORM.update(post, %{state: state}) do
      updated |> covert_cat_state_ifneed |> done
    end
  end

  @doc """
  archive articles based on thread
  called every day by scheduler job
  """
  @spec archive_articles(atom()) :: T.domain_res(term())
  def archive_articles(thread) do
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

  # 调用审核接口失败，等待队列定时处理
  @spec set_article_audit_failed(term(), term()) :: T.domain_res(term())
  def set_article_audit_failed(article, _audit_state) do
    ORM.update(article, %{pending: @audit_failed})
  end

  @doc """
  pending an article due to forbid words or spam talk
  """
  @spec set_article_illegal(atom(), T.id(), map()) :: T.domain_res(term())
  def set_article_illegal(thread, id, audit_state) do
    with {:ok, info} <- match(thread),
         {:ok, article} <- ORM.find(info.model, id) do
      set_article_illegal(article, audit_state)
    end
  end

  @spec set_article_illegal(term(), map()) :: T.domain_res(term())
  def set_article_illegal(article, audit_state) do
    # 1. set pending state
    # 2. set article meta
    # 3. set author meta
    Multi.new()
    |> Multi.run(:update_pending_state, fn _, _ ->
      ORM.update(article, %{pending: @audit_illegal})
    end)
    |> Multi.run(:update_article_meta, fn _, %{update_pending_state: article} ->
      legal_state = Map.take(audit_state, [:is_legal, :illegal_reason, :illegal_words])
      ORM.update_meta(article, legal_state)
    end)
    |> Multi.run(:update_author_meta, fn _, _ ->
      article = Repo.preload(article, :author)
      illegal_articles = Map.get(audit_state, :illegal_articles, [])

      with {:ok, user} <- FrontDesk.info(:user, article.author.user_id) do
        illegal_articles = user.meta.illegal_articles ++ illegal_articles

        ORM.update_meta(user, %{has_illegal_articles: true, illegal_articles: illegal_articles})
      end
    end)
    |> Repo.transaction()
    |> result()
  end

  @spec unset_article_illegal(atom(), T.id(), map()) :: T.domain_res(term())
  def unset_article_illegal(thread, id, audit_state) do
    with {:ok, info} <- match(thread),
         {:ok, article} <- ORM.find(info.model, id) do
      unset_article_illegal(article, audit_state)
    end
  end

  @spec unset_article_illegal(term(), map()) :: T.domain_res(term())
  def unset_article_illegal(article, audit_state) do
    Multi.new()
    |> Multi.run(:update_pending_state, fn _, _ ->
      ORM.update(article, %{pending: @audit_legal})
    end)
    |> Multi.run(:update_article_meta, fn _, %{update_pending_state: article} ->
      legal_state = Map.take(audit_state, [:is_legal, :illegal_reason, :illegal_words])

      ORM.update_meta(article, legal_state)
    end)
    |> Multi.run(:update_author_meta, fn _, _ ->
      article = Repo.preload(article, :author)
      illegal_articles = Map.get(audit_state, :illegal_articles, [])

      with {:ok, user} <- FrontDesk.info(:user, article.author.user_id) do
        illegal_articles = user.meta.illegal_articles -- illegal_articles
        has_illegal_articles = not Enum.empty?(illegal_articles)

        ORM.update_meta(user, %{
          has_illegal_articles: has_illegal_articles,
          illegal_articles: illegal_articles
        })
      end
    end)
    |> Repo.transaction()
    |> result()
  end

  defp mark_viewer_has_states(%{entries: []} = articles, _), do: articles

  defp mark_viewer_has_states(%{entries: entries} = articles, user) do
    entries = Enum.map(entries, &Map.merge(&1, do_mark_viewer_has_states(&1.meta, user)))
    Map.merge(articles, %{entries: entries})
  end

  defp mark_viewer_has_states({:error, reason}, _), do: {:error, reason}

  defp do_mark_viewer_has_states(nil, _) do
    %{
      viewer_has_collected: false,
      viewer_has_upvoted: false,
      viewer_has_viewed: false,
      viewer_has_reported: false
    }
  end

  defp do_mark_viewer_has_states(meta, %User{id: user_id}) do
    # user_is_member = true
    %{
      viewer_has_collected: Enum.member?(meta.collected_user_ids, user_id),
      viewer_has_upvoted: Enum.member?(meta.upvoted_user_ids, user_id),
      viewer_has_viewed: Enum.member?(meta.viewed_user_ids, user_id),
      viewer_has_reported: Enum.member?(meta.reported_user_ids, user_id)
    }
  end

  @doc """
  Creates a article

  ## Examples
  iex> create_article(community, :post, %{title: ...}, user)
  {:ok, %Post{}}
  """

  # def create_article(%Community{slug: nil, id: id}, thread, attrs, user) do
  #   with {:ok, community} <- ORM.find(Community, id) do
  #     create_article(community, thread, attrs, user)
  #   end
  # end

  @spec create_article(Community.t(), atom(), map(), User.t()) :: T.domain_res(term())
  def create_article(%Community{} = community, thread, attrs, %User{} = user) do
    attrs = atom_values_to_upcase(attrs)

    with {:ok, author} <- ensure_author_exists(user),
         {:ok, info} <- match(thread) do
      Transaction.locking(community, fn community ->
        Multi.new()
        |> Multi.run(:create_article, fn _, _ ->
          do_create_article(info.model, attrs, author, community)
        end)
        |> Multi.run(:create_document, fn _, %{create_article: article} ->
          Document.create(article, attrs)
        end)
        |> Multi.run(:mirror_article, fn _, %{create_article: article} ->
          ArticleCommunity.mirror_article(community, article)
        end)
        |> Multi.run(:set_article_tags, fn _, %{create_article: article} ->
          ArticleTag.set_article_tags(community, thread, article, attrs)
        end)
        |> Multi.run(:set_active_at_timestamp, fn _, %{create_article: article} ->
          ORM.update(article, %{active_at: article.inserted_at})
        end)
        |> Multi.run(:update_community_article_count, fn _, _ ->
          CommunityCRUD.update_community_count_field(community, thread)
        end)
        |> Multi.run(:update_community_inner_id, fn _,
                                                    %{
                                                      create_article: article,
                                                      update_community_article_count: community
                                                    } ->
          CommunityCRUD.update_community_inner_id(community, thread, article)
        end)
        |> Multi.run(:update_user_published_meta, fn _, _ ->
          Accounts.update_published_states(user, thread)
        end)
        |> Multi.run(:after_hooks, fn _, %{create_article: article} ->
          Later.run({Hooks.Cite, :handle, [article]})
          Later.run({Hooks.Mention, :handle, [article]})
          Later.run({Hooks.Audition, :handle, [article]})
          Later.run({__MODULE__, :notify_admin_new_article, [article]})
        end)
        |> Multi.run(:log_action, fn _, _ ->
          Statistics.log_publish_action(user)
        end)
        |> Repo.transaction()
        |> result()
      end)
    end
  end

  @doc """
  notify(email) admin about new article
  NOTE:  this method should NOT be private, because this method
  will be called outside this module
  """
  def notify_admin_new_article(%{id: id} = result) do
    target = result.__struct__
    preload = [:community, author: :user]

    with {:ok, article} <- ORM.find(target, id, preload: preload) do
      info = %{
        id: article.id,
        title: article.title,
        digest: Map.get(article, :digest, article.title),
        author_name: article.author.user.nickname,
        community_slug: article.community.slug,
        type:
          result.__struct__ |> to_string |> String.split(".") |> List.last() |> String.downcase()
      }

      Email.notify_admin(info, :new_article)
    end
  end

  @doc """
  update a article(post/job ...)
  """
  @spec update_article(map(), map()) :: T.domain_res(term())
  def update_article(%{is_archived: true}, _attrs),
    do: raise_error(:archived, "article is archived, can not be edit or delete")

  def update_article(article, attrs) do
    attrs = atom_values_to_upcase(attrs)

    Multi.new()
    |> Multi.run(:update_article, fn _, _ ->
      do_update_article(article, attrs)
    end)
    |> Multi.run(:update_document, fn _, %{update_article: update_article} ->
      Document.update(update_article, attrs)
    end)
    |> Multi.run(:set_article_tags, fn _, %{update_article: article} ->
      ArticleTag.overwrite_article_tags(
        %Community{id: article.community_id},
        article.meta.thread,
        article,
        %{article_tags: Map.get(attrs, :article_tags, [])}
      )
    end)
    |> Multi.run(:update_edit_status, fn _, %{set_article_tags: update_article} ->
      ArticleCommunity.update_edit_status(update_article)
    end)
    |> Multi.run(:after_hooks, fn _, %{update_article: update_article} ->
      Later.run({Hooks.Cite, :handle, [update_article]})
      Later.run({Hooks.Mention, :handle, [update_article]})
      Later.run({Hooks.Audition, :handle, [update_article]})
    end)
    |> Repo.transaction()
    |> result()
  end

  @doc """
  update active at timestamp of an article
  """
  @spec update_active_timestamp(atom(), term()) :: T.domain_res(term())
  def update_active_timestamp(thread, article) do
    # @article_active_period
    # 1. 超过时限不更新
    # 2. 已经沉默的不更新, is_sunk
    case in_active_period?(thread, article) do
      true -> ORM.update(article, %{active_at: DateTime.utc_now()})
      _ -> {:ok, :pass}
    end
  end

  @doc """
  sink article
  """
  @spec sink_article(term()) :: T.domain_res(term())
  def sink_article(article) do
    %{inserted_at: inserted_at} = article

    with {:ok, article} <-
           ORM.update_meta(article, %{
             is_sunk: true,
             last_active_at: inserted_at
           }) do
      ORM.update(article, %{active_at: inserted_at})
    end
  end

  @doc """
  undo sink article
  """
  @spec undo_sink_article(term()) :: T.domain_res(term())
  def undo_sink_article(article) do
    thread = thread_of(article)

    with true <- in_active_period?(thread, article),
         {:ok, article} <- ORM.update_meta(article, %{is_sunk: false}) do
      ORM.update(article, %{active_at: article.meta.last_active_at})
    else
      false -> raise_error(:undo_sink_old_article, "can not undo sink old article")
    end
  end

  # check is an article's active_at is in active period
  defp in_active_period?(thread, article) do
    active_period_days = @active_period[thread] || @active_period[:default]

    inserted_at = article.inserted_at
    active_threshold = Timex.shift(Timex.now(), days: -active_period_days)

    :gt == DateTime.compare(inserted_at, active_threshold)
  end

  @doc """
  mark delete false for an article
  """
  @spec mark_delete_article(term()) :: T.domain_res(term())
  def mark_delete_article(article) do
    {:ok, thread} = thread_of(article)

    Transaction.locking(article, fn article ->
      case article.is_archived do
        false ->
          Multi.new()
          |> Multi.run(:update_article, fn _, _ ->
            ORM.update(article, %{mark_delete: true})
          end)
          |> Multi.run(:update_community_article_count, fn _, _ ->
            CommunityCRUD.update_community_count_field(article.communities, thread)
          end)
          |> Repo.transaction()
          |> result()

        true ->
          raise_error(:archived, "article is archived, can not be edit or delete")
      end
    end)
  end

  @doc """
  undo mark delete false for an article
  """
  @spec undo_mark_delete_article(term()) :: T.domain_res(term())
  def undo_mark_delete_article(article) do
    {:ok, thread} = thread_of(article)

    Transaction.locking(article, fn article ->
      Multi.new()
      |> Multi.run(:update_article, fn _, _ ->
        ORM.update(article, %{mark_delete: false})
      end)
      |> Multi.run(:update_community_article_count, fn _, _ ->
        CommunityCRUD.update_community_count_field(article.communities, thread)
      end)
      |> Repo.transaction()
      |> result()
    end)
  end

  @doc """
  make sure the given ids are deleted
  """
  @spec batch_mark_delete_articles(String.t(), atom(), [T.id()]) :: T.domain_res(term())
  def batch_mark_delete_articles(community, thread, inner_id_list) do
    do_batch_mark_delete_articles(community, thread, inner_id_list, true)
  end

  @doc """
  make sure the given ids are deleted
  """
  @spec batch_undo_mark_delete_articles(String.t(), atom(), [T.id()]) :: T.domain_res(term())
  def batch_undo_mark_delete_articles(community, thread, inner_id_list) do
    do_batch_mark_delete_articles(community, thread, inner_id_list, false)
  end

  defp do_batch_mark_delete_articles(community, thread, inner_id_list, delete_flag) do
    with {:ok, info} <- match(thread) do
      batch_query =
        info.model
        |> where([article], article.community_slug == ^community)
        |> where([article], article.inner_id in ^inner_id_list)

      Multi.new()
      |> Multi.run(:update_articles, fn _, _ ->
        batch_query
        |> Repo.update_all(set: [mark_delete: delete_flag])
        |> done
      end)
      |> Multi.run(:update_community_article_count, fn _, _ ->
        communities =
          from(a in batch_query, preload: :communities)
          |> Repo.all()
          |> Enum.map(& &1.communities)
          |> Enum.at(0)

        CommunityCRUD.update_community_count_field(communities, thread)
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @doc """
  remove article forever
  """
  @spec delete_article(term(), String.t()) :: T.domain_res(term())
  def delete_article(article, _reason \\ @remove_article_hint) do
    article = Repo.preload(article, [:communities, [author: :user]])
    {:ok, thread} = thread_of(article)

    Multi.new()
    |> Multi.run(:delete_article, fn _, _ ->
      article |> ORM.delete()
    end)
    |> Multi.run(:update_community_article_count, fn _, _ ->
      CommunityCRUD.update_community_count_field(article.communities, thread)
    end)
    |> Multi.run(:update_user_published_meta, fn _, _ ->
      Accounts.update_published_states(article.author.user, thread)
    end)
    |> Multi.run(:delete_document, fn _, _ ->
      Document.remove(thread, article.id)
      # for those history & test setup case
      {:ok, :pass}
    end)
    |> Repo.transaction()
    |> result()
  end

  @spec ensure_author_exists(User.t()) :: {:ok, Author.t()}
  def ensure_author_exists(%User{} = user) do
    # unique_constraint: avoid race conditions, make sure user_id unique
    # foreign_key_constraint: check foreign key: user_id exist or not
    # see also no_assoc_constraint in https://hexdocs.pm/ecto/Ecto.Changeset.html
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

  defp do_read_article(article, community_slug, thread) do
    Multi.new()
    |> Multi.run(:inc_views, fn _, _ ->
      ORM.inc(article, :views)
    end)
    |> Multi.run(:load_html, fn _, %{inc_views: article} ->
      article |> Repo.preload(:document) |> done
    end)
    |> Multi.run(:add_pinned_flag, fn _, %{load_html: article} ->
      with {:ok, community} <- ORM.find_by(Community, %{slug: community_slug}) do
        pin_query = Map.merge(%{community_id: community.id}, %{"#{thread}_id": article.id})

        case ORM.find_by(PinnedArticle, pin_query) do
          {:ok, _} -> {:ok, Map.merge(article, %{is_pinned: true})}
          {:error, _} -> {:ok, article}
        end
      end
    end)
    |> Multi.run(:update_article_meta, fn _, %{add_pinned_flag: article} ->
      ORM.update_meta(article, %{can_undo_sink: in_active_period?(thread, article)})
    end)
    |> Repo.transaction()
    |> result()
  end

  defp if_article_legal(community_slug, thread, inner_id, user)
       when thread in @article_threads do
    clauses = %{community_slug: community_slug, inner_id: inner_id}

    with {:ok, info} <- match(thread),
         {:ok, article} <- ORM.find_by(info.model, clauses, preload: :author) do
      if_article_legal(article, user)
    end
  end

  defp if_article_legal(community_slug, thread, inner_id)
       when thread in @article_threads do
    clauses = %{community_slug: community_slug, inner_id: inner_id}

    with {:ok, info} <- match(thread),
         {:ok, article} <- ORM.find_by(info.model, clauses) do
      if_article_legal(article)
    end
  end

  # pending article can be seen is viewer is author
  defp if_article_legal(thread, id, %User{} = user) when thread in @article_threads do
    with {:ok, info} <- match(thread),
         {:ok, article} <- ORM.find(info.model, id, preload: :author) do
      if_article_legal(article, user)
    end
  end

  defp if_article_legal(%{pending: @audit_legal} = article, _) do
    {:ok, article}
  end

  defp if_article_legal(%{pending: @audit_failed} = article, _) do
    {:ok, article}
  end

  defp if_article_legal(%{pending: @audit_illegal} = article, %User{id: user_id}) do
    case article.author.user_id == user_id do
      true -> {:ok, article}
      false -> raise_error(:pending, "this article is under audition")
    end
  end

  # pending article should not be seen
  defp if_article_legal(thread, id) when thread in @article_threads do
    with {:ok, info} <- match(thread),
         {:ok, article} <- ORM.find(info.model, id) do
      if_article_legal(article)
    end
  end

  defp if_article_legal(%{pending: @audit_illegal}) do
    raise_error(:pending, "this article is under audition")
  end

  defp if_article_legal(article), do: {:ok, article}

  defp add_pin_articles_ifneed(articles, queryable, %{community: community} = filter) do
    thread = module_to_atom(queryable)

    with true <- should_add_pin?(filter),
         true <- 1 == Map.get(articles, :page_number),
         {:ok, pinned_articles} <-
           PinnedArticle
           |> join(:inner, [p], c in assoc(p, :community))
           |> join(:inner, [p], article in assoc(p, ^thread))
           |> where([p, c, article], c.slug == ^community)
           |> select([p, c, article], article)
           # 10 pinned articles per community/thread, at most
           |> ORM.find_all(%{page: 1, size: 10}) do
      concat_articles(pinned_articles, articles)
    else
      _error -> articles
    end
  end

  defp add_pin_articles_ifneed(articles, _queryable, _filter), do: articles

  # if filter contains like: tags, sort.., then don't add pin article
  defp should_add_pin?(%{page: 1, sort: :desc_active} = filter) do
    skip_pinned_fields = [:article_tag, :article_tags]

    not Enum.any?(Map.keys(filter), &(&1 in skip_pinned_fields))
  end

  defp should_add_pin?(_filter), do: false

  defp concat_articles(%{total_count: 0}, non_pinned_articles), do: non_pinned_articles

  defp concat_articles(pinned_articles, non_pinned_articles) do
    pinned_entries =
      pinned_articles
      |> Map.get(:entries)
      |> Enum.map(&struct(&1, %{is_pinned: true}))

    normal_entries = non_pinned_articles |> Map.get(:entries)

    normal_count = non_pinned_articles |> Map.get(:total_count)

    # remote the pinned article from normal_entries (if have)
    pinned_ids = pick_by(pinned_entries, :id)
    normal_entries = Enum.reject(normal_entries, &(&1.id in pinned_ids))

    non_pinned_articles
    |> Map.put(:entries, pinned_entries ++ normal_entries)
    # those two are equals
    # |> Map.put(:total_count, pinned_count + normal_count - pinned_count)
    |> Map.put(:total_count, normal_count)
  end

  defp do_create_article(
         model,
         %{body: _body} = attrs,
         %Author{id: author_id},
         %Community{} = community
       ) do
    %{id: community_id, meta: community_meta, slug: community_slug} = community
    threads_name = model |> module_to_atom |> plural
    inner_id = community_meta |> Map.get(:"#{threads_name}_inner_id_index")

    meta = @default_article_meta |> Map.merge(%{thread: module_to_upcase(model)})

    with {:ok, attrs} <- add_digest_attrs(attrs) do
      model.__struct__
      |> model.changeset(attrs |> Map.merge(%{inner_id: inner_id + 1}))
      |> Ecto.Changeset.put_change(:emotions, @default_emotions)
      |> Ecto.Changeset.put_change(:author_id, author_id)
      |> Ecto.Changeset.put_change(:community_id, community_id)
      |> Ecto.Changeset.put_change(:community_slug, community_slug)
      |> Ecto.Changeset.put_embed(:meta, meta)
      |> Repo.insert()
    end
  end

  defp do_update_article(article, %{body: _} = attrs) do
    with {:ok, attrs} <- add_digest_attrs(attrs) do
      ORM.update(article, attrs)
    end
  end

  defp do_update_article(article, attrs), do: ORM.update(article, attrs)

  # is update or create article with body field, parsed and expand it into attrs
  defp add_digest_attrs(%{body: body} = attrs) when not is_nil(body) do
    with {:ok, parsed} <- Converter.Article.parse_body(body),
         {:ok, digest} <- Converter.Article.parse_digest(parsed.body_map) do
      attrs
      |> Map.merge(%{digest: digest})
      |> done
    end
  end

  defp add_digest_attrs(attrs), do: attrs

  defp update_viewed_user_list(%{meta: meta} = article, user_id) do
    user_not_viewed = not Enum.member?(meta.viewed_user_ids, user_id)

    case Enum.empty?(meta.viewed_user_ids) or user_not_viewed do
      true ->
        new_ids = Enum.uniq([user_id] ++ meta.viewed_user_ids)
        meta = meta |> Map.merge(%{viewed_user_ids: new_ids})
        ORM.update_meta(article, meta)

      false ->
        {:ok, :pass}
    end
  end

  # create done
  defp result({:ok, %{set_active_at_timestamp: result}}) do
    {:ok, result}
  end

  defp result({:ok, %{update_edit_status: result}}), do: {:ok, result}
  defp result({:ok, %{update_article: result}}), do: {:ok, result}
  defp result({:ok, %{update_articles: _result}}), do: {:ok, %{done: true}}
  defp result({:ok, %{delete_article: result}}), do: {:ok, result}
  # NOTE:  for read article, order is import
  defp result({:ok, %{set_viewer_has_states: result}}), do: result |> done()
  defp result({:ok, %{update_article_meta: result}}), do: {:ok, result}

  defp result({:error, :create_article, _result, _steps}) do
    {:error, {:create_fails, "create article"}}
  end

  defp result({:error, :update_article, _result, _steps}) do
    {:error, {:update_fails, "update article"}}
  end

  defp result({:error, :mirror_article, _result, _steps}) do
    {:error, {:create_fails, "set community"}}
  end

  defp result({:error, :set_community_flag, _result, _steps}) do
    {:error, {:create_fails, "set community flag"}}
  end

  defp result({:error, :log_action, _result, _steps}) do
    {:error, {:create_fails, "log action"}}
  end

  defp result({:error, _, result, _steps}), do: {:error, result}
end
