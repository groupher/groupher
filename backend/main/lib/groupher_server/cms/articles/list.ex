defmodule GroupherServer.CMS.Articles.List do
  @moduledoc """
  Article listing helpers.
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Helper.Matcher
  import ShortMaps

  import Helper.Utils,
    only: [
      done: 1,
      pick_by: 2,
      module_to_atom: 1,
      get_config: 2,
      to_upcase: 1
    ]

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.FrontDesk
  alias CMS.Helper.ArticleEnums
  alias CMS.Model.{CitedArtiment, Community, PinnedArticle, Post}
  alias Helper.Types, as: T
  alias Helper.{ORM, QueryBuilder}

  @article_threads get_config(:article, :threads)
  @article_preloads @article_threads |> Enum.map(&Keyword.new([{&1, [author: :user]}]))
  @comment_article_preloads @article_threads |> Enum.map(&Keyword.new([{:comment, &1}]))
  @cited_preloads @article_preloads ++ [[comment: :author] ++ @comment_article_preloads]
  @article_state ArticleEnums.state_values() |> Enum.into(%{}, &{&1, &1})

  @spec paged(atom(), map()) :: T.domain_res(term())
  def paged(thread, filter) do
    %{page: page, size: size} = filter
    flags = %{mark_delete: false, pending: :legal}

    with {:ok, info} <- match(thread) do
      info.model
      |> QueryBuilder.domain_query(filter)
      |> QueryBuilder.filter_pack(Map.merge(filter, flags))
      |> ORM.paginator(~m(page size)a)
      |> add_pin_articles_ifneed(info.model, filter)
      |> done()
    end
  end

  @spec paged(atom(), map(), User.t()) :: T.domain_res(term())
  def paged(thread, filter, %User{} = user) do
    with {:ok, stateless_paged_articles} <- paged(thread, filter) do
      case stateless_paged_articles
           |> FrontDesk.mark_viewer_emotion_states(user)
           |> mark_viewer_has_states(user) do
        {:error, reason} -> {:error, reason}
        articles -> done(articles)
      end
    end
  end

  @spec grouped_kanban(Community.t()) :: T.domain_res(term())
  def grouped_kanban(%Community{} = community) do
    filter = %{page: 1, size: 20}

    with {:ok, paged_todo} <-
           paged_kanban(community, Map.merge(filter, %{state: @article_state.todo})),
         {:ok, paged_wip} <-
           paged_kanban(community, Map.merge(filter, %{state: @article_state.wip})),
         {:ok, paged_done} <-
           paged_kanban(community, Map.merge(filter, %{state: @article_state.done})) do
      %{
        todo: paged_todo,
        wip: paged_wip,
        done: paged_done
      }
      |> done
    end
  end

  @spec paged_kanban(Community.t(), map()) :: T.domain_res(term())
  def paged_kanban(%Community{} = community, %{state: state} = filter)
      when is_binary(state) do
    state = normalize_article_state(state) || :__invalid__
    filter = filter |> Map.merge(%{state: state})

    paged_kanban(community, filter)
  end

  def paged_kanban(%Community{} = community, filter) do
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
    |> done()
  end

  @spec paged_published(atom(), map(), User.t()) :: T.domain_res(term())
  def paged_published(thread, filter, %User{} = user) do
    %{page: page, size: size} = filter

    with {:ok, info} <- match(thread) do
      info.model
      |> join(:inner, [article], author in assoc(article, :author))
      |> where([article, author], author.user_id == ^user.id)
      |> select([article, author], article)
      |> QueryBuilder.filter_pack(filter)
      |> ORM.paginator(~m(page size)a)
      |> FrontDesk.mark_viewer_emotion_states(user)
      |> mark_viewer_has_states(user)
      |> then(fn result ->
        case result do
          {:error, reason} -> {:error, reason}
          articles -> done(articles)
        end
      end)
    end
  end

  @spec paged_citing_contents(atom(), T.id(), map()) :: T.domain_res(term())
  def paged_citing_contents(cited_by_type, cited_by_id, %{page: page, size: size} = filter) do
    cited_by_type = to_upcase(cited_by_type)

    CitedArtiment
    |> where([c], c.cited_by_id == ^cited_by_id and c.cited_by_type == ^cited_by_type)
    |> QueryBuilder.filter_pack(Map.merge(filter, %{sort: :asc_inserted}))
    |> ORM.paginator(~m(page size)a)
    |> extract_contents()
    |> done
  end

  defp extract_contents(%{entries: entries} = paged_contents) do
    entries = entries |> Repo.preload(@cited_preloads) |> Enum.map(&shape(&1))

    Map.put(paged_contents, :entries, entries)
  end

  @spec shape(CitedArtiment.t()) :: T.cite_info()
  defp shape(%CitedArtiment{comment_id: comment_id} = cited) when not is_nil(comment_id) do
    %{block_linker: block_linker, comment: comment, inserted_at: inserted_at} = cited

    {:ok, article} = FrontDesk.article_of(comment)
    {:ok, article_thread} = FrontDesk.thread_of(article)

    user = comment.author |> Map.take([:login, :nickname, :avatar])

    article
    |> Map.take([:id, :title])
    |> Map.merge(%{
      inserted_at: inserted_at,
      user: user,
      thread: article_thread,
      comment_id: comment.id,
      block_linker: block_linker
    })
  end

  defp shape(%CitedArtiment{} = cited) do
    %{block_linker: block_linker, inserted_at: inserted_at} = cited

    thread = citing_thread(cited)
    article = Map.get(cited, thread)

    user = get_in(article, [:author, :user]) |> Map.take([:login, :nickname, :avatar])

    article
    |> Map.take([:id, :title])
    |> Map.merge(%{
      user: user,
      thread: thread,
      block_linker: block_linker,
      inserted_at: inserted_at
    })
  end

  defp citing_thread(cited) do
    @article_threads |> Enum.find(fn thread -> not is_nil(Map.get(cited, :"#{thread}_id")) end)
  end

  defp normalize_article_state(state) when is_binary(state) do
    state = state |> String.downcase()
    Map.keys(@article_state) |> Enum.find(fn value -> Atom.to_string(value) == state end)
  end

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
           |> ORM.find_all(%{page: 1, size: 10}) do
      concat_articles(pinned_articles, articles)
    else
      _error -> articles
    end
  end

  defp add_pin_articles_ifneed(articles, _queryable, _filter), do: articles

  defp should_add_pin?(%{page: 1, sort: :desc_active} = filter) do
    skip_pinned_fields = [:article_tag, :article_tags, :community_tag, :community_tags]

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

    pinned_ids = pick_by(pinned_entries, :id)
    normal_entries = Enum.reject(normal_entries, &(&1.id in pinned_ids))

    non_pinned_articles
    |> Map.put(:entries, pinned_entries ++ normal_entries)
    |> Map.put(:total_count, normal_count)
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
    %{
      viewer_has_collected: Enum.member?(meta.collected_user_ids, user_id),
      viewer_has_upvoted: Enum.member?(meta.upvoted_user_ids, user_id),
      viewer_has_viewed: Enum.member?(meta.viewed_user_ids, user_id),
      viewer_has_reported: Enum.member?(meta.reported_user_ids, user_id)
    }
  end
end
