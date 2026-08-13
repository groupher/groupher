defmodule GroupherServer.CMS.Communities.Write do
  @moduledoc """
  Write helpers for communities.

  Business position:

      Client / reviewer
        -> CMS.Communities
        -> Write
        -> Repo / Oban
  """
  import GroupherServer.CMS.Articles.Write, only: [ensure_author_exists: 1]

  alias GroupherServer.{Accounts, Analysis, CMS}
  alias GroupherServer.CMS.Communities.{Lifecycle, Moderator, Read}
  alias GroupherServer.CMS.Dashboard.BaseInfo

  alias Accounts.Model.User
  alias CMS.Model.{Community, CommunityDashboard, Embeds}
  alias Helper.{ORM, T}
  require Logger

  @default_meta Embeds.CommunityMeta.default_meta()
  @default_dashboard CommunityDashboard.default()
  @default_community_settings %{meta: @default_meta, dashboard: @default_dashboard}

  @doc """
  create a community
  """
  @spec create(map(), User.t()) :: T.domain_res(Community.t())
  def create(args, %User{} = user) do
    with {:ok, community} <- do_create(args, user),
         {:ok, _lifecycle} <- Lifecycle.ensure_created(community.id),
         {:ok, _} <- init_community_root(community, user),
         {:ok, _} <- CMS.DocTree.initialize(community),
         {:ok, community} <- Read.read(community.slug, inc_views: false) do
      provision_web_analysis(community)
      {:ok, community}
    end
  end

  @doc "Creates only the core Community row; initialization belongs to Communities.Setup."
  @spec create_core(map(), User.t()) :: T.domain_res(Community.t())
  def create_core(args, %User{} = user), do: do_create(args, user)

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

  defp provision_web_analysis(%Community{} = community) do
    case Analysis.Web.provision_community(community) do
      {:ok, _website_id} ->
        :ok

      {:error, :not_configured} ->
        :ok

      {:error, reason} ->
        Logger.warning(
          "Community web analysis provisioning failed; query-side provisioning will retry",
          community_id: community.id,
          reason: inspect(reason)
        )

        :ok
    end
  end
end
