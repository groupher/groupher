defmodule GroupherServer.CMS.Delegate.CommunityCRUD do
  @moduledoc """
  community curd
  """
  import Ecto.Query, warn: false

  import Helper.Utils,
    only: [done: 1, strip_struct: 1, get_config: 2, plural: 1, ensure: 2]

  import GroupherServer.CMS.Delegate.ArticleCRUD, only: [ensure_author_exists: 1]
  import GroupherServer.CMS.Helper.Matcher
  import ShortMaps

  alias Helper.{ORM, QueryBuilder, OSS, Constant, Transaction}
  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User

  alias CMS.Model.{
    Embeds,
    ArticleTag,
    Category,
    Community,
    CommunityDashboard,
    CommunityModerator,
    CommunitySubscriber,
    Thread
  }

  @default_meta Embeds.CommunityMeta.default_meta()
  @default_dashboard CommunityDashboard.default()
  @default_community_settings %{meta: @default_meta, dashboard: @default_dashboard}

  @article_threads get_config(:article, :threads)
  @community_default_threads get_config(:general, :community_default_threads)

  @default_user_meta Accounts.Model.Embeds.UserMeta.default_meta()
  @community_normal Constant.CMS.pending(:normal)
  @community_applying Constant.CMS.pending(:applying)

  @default_apply_category Constant.CMS.apply_category(:web)

  @default_read_opt [inc_views: true]

  def read_community(slug, opt \\ @default_read_opt)

  def read_community(slug, %User{} = user) do
    read_community(slug, @default_read_opt) |> viewer_has_states(user)
  end

  def read_community(slug, %User{} = user, opt) do
    read_community(slug, opt) |> viewer_has_states(user)
  end

  def read_community(slug, opt), do: do_read_community(slug, opt)

  def paged_communities(filter, %User{meta: meta}) do
    with {:ok, paged_communities} <- paged_communities(filter) do
      %{entries: entries} = paged_communities

      entries =
        Enum.map(entries, fn community ->
          viewer_has_subscribed = community.id in meta.subscribed_communities_ids
          %{community | viewer_has_subscribed: viewer_has_subscribed}
        end)

      %{paged_communities | entries: entries} |> done
    end
  end

  def paged_communities(filter) do
    filter = filter |> Enum.reject(fn {_k, v} -> is_nil(v) end) |> Enum.into(%{})
    Community |> ORM.find_all(filter)
  end

  @doc """
  create a community
  """
  def create_community(args, %User{} = user) do
    with {:ok, community} <- do_create_community(args, user),
         {:ok, _} <- init_community_root(community, user),
         {:ok, threads} = create_default_threads_ifneed() do
      Enum.each(threads, fn thread ->
        CMS.set_thread(community, thread)
      end)

      read_community(community.slug, inc_views: false)
    end
  end

  def delete_community(community) do
    with {:ok, community} <- ORM.find_by(Community, slug: community) do
      community |> ORM.delete()
    end
  end

  defp do_create_community(args, %User{} = user) do
    with {:ok, author} <- ensure_author_exists(%User{id: user.id}) do
      args =
        args |> Map.merge(%{user_id: author.user_id}) |> Map.merge(@default_community_settings)

      Community |> ORM.create(args)
    end
  end

  defp init_community_root(%Community{} = community, %User{} = user, role \\ "root") do
    CMS.add_moderator(community, role, user, user)
  end

  def create_default_threads_ifneed() do
    @community_default_threads
    |> Enum.with_index()
    |> Enum.map(fn {thread, index} ->
      title = thread |> Atom.to_string()
      slug = title

      case ORM.find_by(Thread, slug: slug) do
        {:ok, _} -> {:ok, :pass}
        {:error, _} -> CMS.create_thread(~m(title slug index)a)
      end
    end)

    exist_threads = @community_default_threads |> Enum.map(&to_string(&1))

    from(t in Thread, where: t.slug in ^exist_threads) |> Repo.all() |> done
  end

  @doc """
  update community
  """
  def update_community(%Community{} = community, args) do
    with {:ok, community} <- fill_meta(community) do
      ORM.update(community, args)
    end
  end

  @doc """
  update dashboard settings of a community
  """
  def update_dashboard(%Community{} = community, :base_info, args) do
    main_fields =
      Map.take(args, [:title, :locale, :desc, :logo, :favicon, :slug, :homepage])
      |> OSS.persist_file(:logo)
      |> OSS.persist_file(:favicon)

    with {:ok, community} <- update_community_if_need(community, main_fields) do
      do_update_dashboard(community, :base_info, Map.merge(args, main_fields))
    end
  end

  def update_dashboard(%Community{} = community, key, args) do
    do_update_dashboard(community, key, args)
  end

  # see https://elixirforum.com/t/pattern-match-on-empty-maps/33259/5
  defp update_community_if_need(%Community{} = community, fields) when map_size(fields) == 0 do
    {:ok, community}
  end

  defp update_community_if_need(%Community{} = community, fields) do
    ORM.update(community, fields)
  end

  defp do_update_dashboard(%Community{} = community, key, args) do
    with {:ok, community_dashboard} <- ensure_dashboard_exist(community),
         {:ok, _} <- ORM.update_dashboard(community_dashboard, key, args) do
      {:ok, community}
    end
  end

  defp ensure_dashboard_exist(%Community{} = community) do
    case ORM.find_by(CommunityDashboard, community_id: community.id) do
      {:error, _} ->
        ORM.create(
          CommunityDashboard,
          %{community_id: community.id} |> Map.merge(@default_dashboard)
        )

      {:ok, community_dashboard} ->
        {:ok, community_dashboard}
    end
  end

  @doc """
  check if community exist
  """
  def community_exist?(slug) do
    case ORM.find_by(Community, slug: slug) do
      {:ok, _} -> {:ok, %{exist: true}}
      {:error, _} -> {:ok, %{exist: false}}
    end
  end

  def has_pending_community_apply?(%User{} = user) do
    with {:ok, paged_applies} <- paged_community_applies(user, %{page: 1, size: 1}) do
      case paged_applies.total_count > 0 do
        true -> {:ok, %{exist: true}}
        false -> {:ok, %{exist: false}}
      end
    end
  end

  def paged_community_applies(%User{} = user, %{page: page, size: size} = _filter) do
    Community
    |> where([c], c.pending == ^@community_applying)
    |> where([c], c.user_id == ^user.id)
    |> ORM.paginator(~m(page size)a)
    |> done
  end

  def apply_community(args, %User{} = user) do
    with {:ok, community} <-
           create_community(Map.merge(args, %{pending: @community_applying}), user) do
      apply_msg = Map.get(args, :apply_msg, "")
      apply_category = Map.get(args, :apply_category, @default_apply_category)

      meta = community.meta |> Map.merge(~m(apply_msg apply_category)a)
      ORM.update_meta(community, meta)
    end
  end

  def approve_community_apply(slug) do
    # TODO: create community with thread, category and tags
    with {:ok, community} <- ORM.find_by(Community, slug: slug) do
      ORM.update(community, %{pending: @community_normal})
    end
  end

  def deny_community_apply(id) do
    with {:ok, community} <- ORM.find(Community, id) do
      case community.pending == @community_applying do
        true -> ORM.delete(community)
        false -> {:ok, community}
      end
    end
  end

  @doc """
  update article_tags_count / thread / article_count / subscribers_count of a community
  """
  def update_community_count_field(
        %Community{} = community,
        %User{} = user,
        :moderators_count,
        opt
      ) do
    with {:ok, community} <- fill_meta(community) do
      moderators_ids =
        case opt do
          :inc -> (community.meta.moderators_ids ++ [user.id]) |> Enum.uniq()
          :dec -> (community.meta.moderators_ids -- [user.id]) |> Enum.uniq()
        end

      {:ok, community} = ORM.update_meta(community, %{moderators_ids: moderators_ids})
      ORM.inc(community, :moderators_count)
    end
  end

  def update_community_count_field(
        %Community{} = community,
        %User{} = user,
        :subscribers_count,
        opt
      ) do
    with {:ok, community} <- fill_meta(community) do
      subscribed_user_ids =
        case opt do
          :inc -> (community.meta.subscribed_user_ids ++ [user.id]) |> Enum.uniq()
          :dec -> (community.meta.subscribed_user_ids -- [user.id]) |> Enum.uniq()
        end

      {:ok, community} = ORM.update_meta(community, %{subscribed_user_ids: subscribed_user_ids})

      case opt do
        :inc -> ORM.inc(community, :subscribers_count)
        :dec -> ORM.dec(community, :subscribers_count)
      end
    end
  end

  def update_community_inner_id(
        %Community{meta: community_meta} = community,
        thread,
        %{inner_id: inner_id} = article
      ) do
    thread_inner_id_key = :"#{plural(thread)}_inner_id_index"
    meta = community_meta |> Map.put(thread_inner_id_key, inner_id) |> strip_struct

    ORM.update_meta(community, meta)
  end

  def update_community_count_field(%Community{} = community, :article_tags_count) do
    {:ok, article_tags_count} =
      from(t in ArticleTag, where: t.community_id == ^community.id) |> ORM.count()

    community
    |> Ecto.Changeset.change(%{article_tags_count: article_tags_count})
    |> Repo.update()
  end

  def update_community_count_field(communities, thread) when is_list(communities) do
    case Enum.all?(Enum.uniq(communities), &({:ok, _} = update_community_count_field(&1, thread))) do
      true -> {:ok, :pass}
      false -> {:error, "update_community_count_field"}
    end
  end

  def update_community_count_field(%Community{} = community, thread) do
    with {:ok, info} <- match(thread) do
      {:ok, thread_article_count} =
        from(a in info.model,
          join: c in assoc(a, :communities),
          where: a.mark_delete == false and c.id == ^community.id
        )
        |> ORM.count(prefix: Constant.DBPrefix.cms())

      meta = Map.put(community.meta, :"#{plural(thread)}_count", thread_article_count)

      Transaction.locking(community, fn community ->
        {:ok, community} = ORM.update_meta(community, meta)
        ORM.update(community, %{articles_count: recount_articles_count(community.meta)})
      end)
    end
  end

  defp recount_articles_count(meta) do
    @article_threads |> Enum.reduce(0, &(&2 + Map.get(meta, :"#{plural(&1)}_count")))
  end

  @doc """
  return paged community subscribers
  """
  def community_members(:moderators, %Community{id: id} = community, filters)
      when not is_nil(id) do
    load_community_members(community, CommunityModerator, filters)
  end

  def community_members(:moderators, %Community{slug: slug} = community, filters)
      when not is_nil(slug) do
    load_community_members(community, CommunityModerator, filters)
  end

  def community_members(:subscribers, %Community{id: id} = community, filters, %User{meta: meta})
      when not is_nil(id) do
    with {:ok, members} <- community_members(:subscribers, community, filters) do
      user_meta = ensure(meta, @default_user_meta)

      %{entries: entries} = members

      entries =
        Enum.map(entries, fn member ->
          %{member | viewer_has_followed: member.id in user_meta.following_user_ids}
        end)

      %{members | entries: entries} |> done
    end
  end

  def community_members(:subscribers, %Community{id: id} = community, filters)
      when not is_nil(id) do
    load_community_members(community, CommunitySubscriber, filters)
  end

  def community_members(:subscribers, %Community{slug: slug} = community, filters)
      when not is_nil(slug) do
    load_community_members(community, CommunitySubscriber, filters)
  end

  def create_category(attrs, %User{id: user_id}) do
    with {:ok, author} <- ensure_author_exists(%User{id: user_id}) do
      attrs = attrs |> Map.merge(%{author_id: author.id})
      Category |> ORM.create(attrs)
    end
  end

  def update_category(~m(%Category id title)a) do
    with {:ok, category} <- ORM.find(Category, id) do
      category |> ORM.update(~m(title)a)
    end
  end

  @doc """
  TODO: create_thread
  """
  def create_thread(attrs) do
    slug = to_string(attrs.slug)
    title = attrs.title
    index = attrs |> Map.get(:index, 0)

    Thread |> ORM.create(~m(title slug index)a)
  end

  @doc """
  return community geo infos
  """
  def community_geo_info(%Community{id: community_id}) do
    with {:ok, community} <- ORM.find(Community, community_id) do
      geo_info_data =
        community.geo_info
        |> Map.get("data")
        |> Enum.map(fn data ->
          for {key, val} <- data, into: %{}, do: {String.to_atom(key), val}
        end)
        |> Enum.reject(&(&1.value <= 0))

      {:ok, geo_info_data}
    end
  end

  @doc "count the total threads in community"
  def count(%Community{id: id}, :threads) do
    with {:ok, community} <- ORM.find(Community, id, preload: :threads) do
      {:ok, length(community.threads)}
    end
  end

  @doc "count the total tags in community"
  def count(%Community{id: id}, :article_tags) do
    with {:ok, community} <- ORM.find(Community, id) do
      result =
        ArticleTag
        |> where([t], t.community_id == ^community.id)
        |> ORM.paginator(page: 1, size: 1)

      {:ok, result.total_count}
    end
  end

  defp do_read_community(slug, opt) do
    with {:ok, community} <- ORM.find_community(slug),
         {:ok, community} <- ensure_community_with_dashboard(community),
         {:ok, community} <- fill_meta(community),
         {:ok, community} <- read_moderators(community) do
      case get_in(opt, [:inc_views]) do
        true -> ORM.inc(community, :views)
        false -> {:ok, community}
      end
    end
  end

  defp fill_meta(%Community{meta: nil} = community) do
    ORM.update_meta(community, @default_meta)
  end

  defp fill_meta(%Community{} = community), do: {:ok, community}

  defp read_moderators(%Community{} = community) do
    community |> Map.merge(%{moderators: community.moderators}) |> done
  end

  defp ensure_community_with_dashboard(%Community{dashboard: nil} = community) do
    community
    |> Ecto.Changeset.change()
    |> Ecto.Changeset.put_assoc(:dashboard, @default_dashboard)
    |> Repo.update()
  end

  defp ensure_community_with_dashboard(%Community{} = community), do: {:ok, community}

  defp viewer_has_states({:ok, community}, %User{id: user_id}) do
    viewer_has_states = %{
      viewer_has_subscribed: user_id in community.meta.subscribed_user_ids,
      viewer_is_moderator: user_id in community.meta.moderators_ids
    }

    {:ok, Map.merge(community, viewer_has_states)}
  end

  defp viewer_has_states({:error, reason}, _user), do: {:error, reason}

  defp load_community_members(%Community{id: id}, queryable, %{page: page, size: size} = filters)
       when not is_nil(id) do
    queryable
    |> where([c], c.community_id == ^id)
    |> QueryBuilder.load_inner_users(filters)
    |> ORM.paginator(~m(page size)a)
    |> done()
  end

  defp load_community_members(
         %Community{slug: slug},
         queryable,
         %{page: page, size: size} = filters
       ) do
    queryable
    |> join(:inner, [member], c in assoc(member, :community))
    |> where([member, c], c.slug == ^slug)
    |> join(:inner, [member], u in assoc(member, :user))
    |> select([member, c, u], u)
    |> QueryBuilder.filter_pack(filters)
    |> ORM.paginator(~m(page size)a)
    |> done()
  end
end
