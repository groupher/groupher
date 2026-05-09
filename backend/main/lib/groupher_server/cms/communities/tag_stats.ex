defmodule GroupherServer.CMS.Communities.TagStats do
  @moduledoc """
  Maintains cached counters for community tags.

  The source of truth remains articles plus community tag associations. These
  counters are updated on write paths and can be rebuilt from source data.
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{CMS, Repo}
  alias CMS.FrontDesk
  alias CMS.Model.{Blog, Changelog, Community, CommunityTag, CommunityTagStat, Post}
  alias Helper.{Constant, Datetime, ORM, T}

  @audit_illegal Constant.CMS.pending(:illegal)
  @tracked_threads [:post, :blog, :changelog]
  @default_thread :post

  @spec inc(Ecto.Schema.t(), CommunityTag.t() | T.id()) :: T.domain_res(:pass)
  def inc(article, tag), do: do_update(article, tag, 1)

  @spec dec(Ecto.Schema.t(), CommunityTag.t() | T.id()) :: T.domain_res(:pass)
  def dec(article, tag), do: do_update(article, tag, -1)

  @spec do_update(Ecto.Schema.t(), CommunityTag.t() | T.id(), integer()) :: T.domain_res(:pass)
  defp do_update(article, tag, delta) when delta in [-1, 1] do
    with {:ok, tag} <- ensure_tag(tag),
         true <- trackable_tag?(tag),
         {:ok, true} <- trackable_article?(article) do
      upsert_delta(article, tag, delta)
    else
      false -> done(:pass)
      {:ok, false} -> done(:pass)
      error -> error
    end
  end

  @spec rebuild(CommunityTag.t() | T.id()) :: T.domain_res(CommunityTagStat.t())
  def rebuild(tag) do
    with {:ok, tag} <- ensure_tag(tag) do
      case trackable_tag?(tag) do
        true -> do_rebuild(tag)
        false -> empty_stat(tag)
      end
    end
  end

  defp trackable_tag?(%CommunityTag{thread: thread}), do: thread in @tracked_threads
  defp trackable_tag?(%CommunityTag{}), do: false

  @spec rebuild_for_community(Community.t() | String.t(), atom()) :: T.domain_res(:pass)
  def rebuild_for_community(community, thread \\ @default_thread)

  def rebuild_for_community(%Community{} = community, thread) do
    CommunityTag
    |> where([t], t.community_id == ^community.id and t.thread == ^thread)
    |> Repo.all()
    |> Enum.reduce_while(done(:pass), fn tag, {:ok, :pass} ->
      case rebuild(tag) do
        {:ok, _} -> {:cont, done(:pass)}
        error -> {:halt, error}
      end
    end)
  end

  def rebuild_for_community(community, thread) when is_binary(community) do
    with {:ok, community} <- ORM.find_by(Community, slug: community) do
      rebuild_for_community(community, thread)
    end
  end

  defp do_rebuild(%CommunityTag{} = tag) do
    today = Datetime.today()
    day_start = Datetime.beginning_of_day(today)
    day_end = Datetime.end_of_day(today)

    base_query = base_rebuild_query(tag)

    contents_count = base_query |> select([a, _t], count(a.id)) |> Repo.one()

    today_contents_count =
      base_query
      |> where([a, _t], a.inserted_at >= ^day_start and a.inserted_at <= ^day_end)
      |> select([a, _t], count(a.id))
      |> Repo.one()

    last_posted_at =
      base_query
      |> select([a, _t], max(a.inserted_at))
      |> Repo.one()

    attrs = %{
      community_tag_id: tag.id,
      community_id: tag.community_id,
      thread: tag.thread,
      contents_count: contents_count,
      today_contents_count: today_contents_count,
      today_stat_date: today,
      last_posted_at: last_posted_at
    }

    %CommunityTagStat{}
    |> CommunityTagStat.changeset(attrs)
    |> Repo.insert(
      on_conflict:
        {:replace,
         [:contents_count, :today_contents_count, :today_stat_date, :last_posted_at, :updated_at]},
      conflict_target: :community_tag_id
    )
  end

  defp base_rebuild_query(%CommunityTag{thread: thread} = tag) do
    thread
    |> article_schema()
    |> join(:inner, [a], t in assoc(a, :community_tags))
    |> where([_a, t], t.id == ^tag.id)
    |> where([a, _t], a.mark_delete == false and a.pending != ^@audit_illegal)
  end

  defp article_schema(:post), do: Post
  defp article_schema(:blog), do: Blog
  defp article_schema(:changelog), do: Changelog

  @spec get(CommunityTag.t() | T.id()) :: T.domain_res(CommunityTagStat.t())
  def get(tag) do
    with {:ok, tag} <- ensure_tag(tag) do
      case ORM.find_by(CommunityTagStat, community_tag_id: tag.id) do
        {:ok, stat} -> normalize_today(stat)
        {:error, _} -> empty_stat(tag)
      end
    end
  end

  @spec get(String.t(), atom(), String.t()) :: T.domain_res(CommunityTagStat.t())
  def get(community, thread, slug) do
    with {:ok, tag} <- FrontDesk.community_tag(community, thread, slug) do
      get(tag)
    end
  end

  defp upsert_delta(article, %CommunityTag{} = tag, delta) do
    today = Datetime.today()
    now = Datetime.now(:second)
    today_delta = if same_utc_day?(article.inserted_at, today), do: delta, else: 0
    last_posted_at = if delta > 0, do: article.inserted_at, else: nil

    query = """
    INSERT INTO cms.community_tag_stats (
      community_tag_id,
      community_id,
      thread,
      contents_count,
      today_contents_count,
      today_stat_date,
      last_posted_at,
      inserted_at,
      updated_at
    )
    VALUES ($1, $2, $3, GREATEST($4, 0), GREATEST($5, 0), $6, $7, $8, $8)
    ON CONFLICT (community_tag_id) DO UPDATE SET
      contents_count = GREATEST(cms.community_tag_stats.contents_count + $4, 0),
      today_contents_count = CASE
        WHEN cms.community_tag_stats.today_stat_date = $6
          THEN GREATEST(cms.community_tag_stats.today_contents_count + $5, 0)
        ELSE GREATEST($5, 0)
      END,
      today_stat_date = $6,
      last_posted_at = CASE
        WHEN $4 > 0
          THEN GREATEST(COALESCE(cms.community_tag_stats.last_posted_at, $7), $7)
        ELSE cms.community_tag_stats.last_posted_at
      END,
      updated_at = $8
    """

    Repo.query(query, [
      tag.id,
      tag.community_id,
      Atom.to_string(tag.thread),
      delta,
      today_delta,
      today,
      last_posted_at,
      now
    ])
    |> case do
      {:ok, _} -> done(:pass)
      error -> error
    end
  end

  defp normalize_today(%CommunityTagStat{today_stat_date: today} = stat) do
    case today == Datetime.today() do
      true -> done(stat)
      false -> done(%{stat | today_contents_count: 0})
    end
  end

  defp empty_stat({:ok, %CommunityTag{} = tag}), do: empty_stat(tag)

  defp empty_stat(%CommunityTag{} = tag) do
    %CommunityTagStat{
      community_tag_id: tag.id,
      community_id: tag.community_id,
      thread: tag.thread,
      contents_count: 0,
      today_contents_count: 0,
      today_stat_date: Datetime.today()
    }
    |> done()
  end

  defp ensure_tag(%CommunityTag{} = tag), do: done(tag)
  defp ensure_tag(id), do: FrontDesk.community_tag(id)

  defp trackable_article?(article) do
    with {:ok, thread} <- FrontDesk.thread_of(article) do
      done(thread in @tracked_threads and visible?(article))
    end
  end

  defp visible?(article) do
    Map.get(article, :mark_delete) == false and Map.get(article, :pending) != @audit_illegal
  end

  defp same_utc_day?(nil, _today), do: false

  defp same_utc_day?(inserted_at, today) do
    inserted_at
    |> Datetime.to_date()
    |> Kernel.==(today)
  end
end
