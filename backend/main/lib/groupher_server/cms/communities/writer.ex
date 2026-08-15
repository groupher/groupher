defmodule GroupherServer.CMS.Communities.Writer do
  @moduledoc """
  Writer helpers for communities.

  Business position:

      Client / reviewer
        -> CMS.Communities
        -> Writer
        -> Repo / Oban
  """
  import GroupherServer.CMS.Articles.Writer, only: [ensure_author_exists: 1]

  alias GroupherServer.{Accounts, Analysis, CMS}
  alias GroupherServer.CMS.Communities.{Lifecycle, Moderator, Reader}
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
         {:ok, community} <- Reader.fetch(community.slug, inc_views: false) do
      provision_web_analysis(community)
      {:ok, community}
    end
  end

  @doc "Creates only the core Community row; initialization belongs to Communities.Setup."
  @spec create_core(map(), User.t()) :: T.domain_res(Community.t())
  def create_core(args, %User{} = user), do: do_create(args, user)

  @doc """
  update community
  """
  @spec update(Community.t(), map(), User.t() | :operations) :: T.domain_res(Community.t())
  def update(%Community{} = community, args, actor) when actor == :operations do
    update_unlocked(community, args, actor)
  end

  def update(%Community{} = community, args, %User{} = actor) do
    update_unlocked(community, args, actor)
  end

  def update(%Community{}, _args, _actor), do: {:error, :actor_required}

  defp update_unlocked(%Community{} = community, args, actor) do
    with {:ok, _canonical} <- CMS.Gate.access_check(actor, :update, community),
         {:ok, community} <- ORM.fill_meta(community) do
      ORM.update(community, args)
    end
  end

  @doc """
  Sync community-owned identity fields edited from dashboard base info.
  """
  @spec sync_base_info(Community.t(), map(), User.t() | :operations) ::
          T.domain_res(Community.t())
  def sync_base_info(%Community{} = community, args, actor)
      when actor == :operations or is_struct(actor, User) do
    with {:ok, _canonical} <- CMS.Gate.access_check(actor, :update, community) do
      sync_base_info_unlocked(community, args)
    end
  end

  def sync_base_info(%Community{}, _args, _actor), do: {:error, :actor_required}

  defp sync_base_info_unlocked(%Community{} = community, args) do
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
