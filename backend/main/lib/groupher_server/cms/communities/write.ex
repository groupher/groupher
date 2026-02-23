defmodule GroupherServer.CMS.Communities.Write do
  @moduledoc """
  Write helpers for communities.
  """
  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1, get_config: 2]
  import GroupherServer.CMS.Articles.Write, only: [ensure_author_exists: 1]
  import ShortMaps

  alias Helper.ORM
  alias Helper.Types, as: T
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Communities
  alias CMS.Model.{Community, Embeds, CommunityDashboard, Thread}

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

  def create_default_threads_ifneed() do
    @community_default_threads
    |> Enum.with_index()
    |> Enum.map(fn {thread, index} ->
      title = thread |> Atom.to_string()
      slug = title

      case ORM.find_by(Thread, slug: slug) do
        {:ok, _} -> {:ok, :pass}
        {:error, _} -> Communities.Threads.create(~m(title slug index)a)
      end
    end)

    exist_threads = @community_default_threads |> Enum.map(&to_string(&1))

    from(t in Thread, where: t.slug in ^exist_threads) |> Repo.all() |> done
  end
end
