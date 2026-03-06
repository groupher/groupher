defmodule GroupherServer.CMS.Communities.Write do
  @moduledoc """
  Write helpers for communities.
  """
  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1, get_config: 2]
  import GroupherServer.CMS.Articles.Write, only: [ensure_author_exists: 1]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Communities
  alias CMS.Model.{Community, CommunityDashboard, Embeds, Thread}
  alias Helper.{ORM, T}

  @default_meta Embeds.CommunityMeta.default_meta()
  @default_dashboard CommunityDashboard.default()
  @default_community_settings %{meta: @default_meta, dashboard: @default_dashboard}
  @community_default_threads get_config(:general, :community_default_threads)

  @doc """
  create a community
  """
  @spec create(map(), User.t()) :: T.domain_res(Community.t())
  def create(args, %User{} = user) do
    with {:ok, community} <- do_create(args, user),
         {:ok, _} <- init_community_root(community, user) do
      {:ok, threads} = create_default_threads_ifneed()

      Enum.each(threads, fn thread ->
        Communities.Threads.set(community, thread)
      end)

      Communities.Read.read(community.slug, inc_views: false)
    end
  end

  @spec delete(String.t() | Community.t()) :: T.domain_res(Community.t())
  def delete(community) do
    with {:ok, community} <- ORM.find_by(Community, slug: community) do
      community |> ORM.delete()
    end
  end

  @doc """
  update community
  """
  @spec update(Community.t(), map()) :: T.domain_res(Community.t())
  def update(%Community{} = community, args) do
    with {:ok, community} <- ORM.fill_meta(community) do
      ORM.update(community, args)
    end
  end

  defp do_create(args, %User{} = user) do
    with {:ok, author} <- ensure_author_exists(%User{id: user.id}) do
      args =
        args |> Map.merge(%{user_id: author.user_id}) |> Map.merge(@default_community_settings)

      Community |> ORM.create(args)
    end
  end

  defp init_community_root(%Community{} = community, %User{} = user, role \\ "root") do
    Communities.Moderator.add(community, role, user, user)
  end

  def create_default_threads_ifneed do
    Repo.transaction(fn ->
      Repo.query!("SELECT pg_advisory_xact_lock($1)", [2_024_040_1])

      default_threads = @community_default_threads |> Enum.map(&to_string(&1))

      existing_threads =
        from(t in Thread, where: t.slug in ^default_threads)
        |> Repo.all()

      existing_slugs = MapSet.new(existing_threads, & &1.slug)

      missing_rows =
        @community_default_threads
        |> Enum.with_index()
        |> Enum.map(fn {thread, index} ->
          build_default_thread_row(thread, index)
        end)
        |> Enum.reject(fn row -> MapSet.member?(existing_slugs, row.slug) end)

      if missing_rows != [] do
        Repo.insert_all(Thread, missing_rows, on_conflict: :nothing, conflict_target: [:title])
      end

      from(t in Thread, where: t.slug in ^default_threads) |> Repo.all()
    end)
    |> case do
      {:ok, threads} -> done(threads)
      {:error, reason} -> {:error, reason}
    end
  end

  defp build_default_thread_row(thread, index) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)
    title = thread |> Atom.to_string()

    %{
      title: title,
      slug: title,
      index: index,
      inserted_at: now,
      updated_at: now
    }
  end
end
