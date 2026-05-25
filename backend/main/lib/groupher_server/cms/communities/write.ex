defmodule GroupherServer.CMS.Communities.Write do
  @moduledoc """
  Write helpers for communities.
  """
  import GroupherServer.CMS.Articles.Write, only: [ensure_author_exists: 1]

  alias GroupherServer.{Accounts, CMS}
  alias GroupherServer.CMS.Communities.{Moderator, Read}
  alias GroupherServer.CMS.Dashboard.BaseInfo

  alias Accounts.Model.User
  alias CMS.Model.{Community, CommunityDashboard, Embeds}
  alias Helper.{ORM, T}

  @default_meta Embeds.CommunityMeta.default_meta()
  @default_dashboard CommunityDashboard.default()
  @default_community_settings %{meta: @default_meta, dashboard: @default_dashboard}

  @doc """
  create a community
  """
  @spec create(map(), User.t()) :: T.domain_res(Community.t())
  def create(args, %User{} = user) do
    with {:ok, community} <- do_create(args, user),
         {:ok, _} <- init_community_root(community, user) do
      Read.read(community.slug, inc_views: false)
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

  @doc """
  Sync community-owned identity fields edited from dashboard base info.
  """
  @spec sync_base_info(Community.t(), map()) :: T.domain_res(Community.t())
  def sync_base_info(%Community{} = community, args) do
    args = BaseInfo.take_community_fields(args)

    case map_size(args) do
      0 -> {:ok, community}
      _ -> ORM.update(community, args)
    end
  end

  defp do_create(args, %User{} = user) do
    with {:ok, author} <- ensure_author_exists(%User{id: user.id}) do
      args =
        args |> Map.merge(%{user_id: author.user_id}) |> Map.merge(@default_community_settings)

      Community |> ORM.create(args)
    end
  end

  defp init_community_root(%Community{} = community, %User{} = user) do
    Moderator.add_root(community, user)
  end
end
