defmodule GroupherServer.CMS.Dashboard.Write do
  @moduledoc false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.CMS.Dashboard.{BaseInfo, SectionPayload}
  alias GroupherServer.CMS.Model.{Community, CommunityDashboard}
  alias Helper.{ORM, T, Transaction}

  @default_dashboard CommunityDashboard.default()

  @spec update(Community.t(), map()) :: T.domain_res(CommunityDashboard.t())
  def update(%Community{} = community, %{dsb_section: key} = args) do
    update(community, key, SectionPayload.section_args(key, args))
  end

  def update(%Community{}, _args), do: {:error, :invalid_dsb_section}

  @spec update(Community.t(), atom(), map() | list()) :: T.domain_res(CommunityDashboard.t())
  def update(%Community{} = community, :base_info, args) do
    with {:ok, community_dashboard} <- ensure_exist(community),
         {:ok, section_payload} <-
           SectionPayload.prepare(
             community_dashboard,
             :base_info,
             Map.merge(args, BaseInfo.take_community_fields(args))
           ) do
      Repo.transaction(fn ->
        with {:ok, _community} <- CMS.Communities.sync_base_info(community, args),
             {:ok, community_dashboard} <-
               ORM.replace_dsb_section(community_dashboard, :base_info, section_payload) do
          community_dashboard
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  def update(%Community{} = community, key, args) do
    update_section(community, key, args)
  end

  @spec update_section(Community.t(), atom(), map() | list()) ::
          T.domain_res(CommunityDashboard.t())
  def update_section(%Community{} = community, key, args) do
    with {:ok, community_dashboard} <- ensure_exist(community),
         {:ok, community_dashboard} <- replace_section(community_dashboard, key, args) do
      {:ok, community_dashboard}
    end
  end

  @spec replace_section(CommunityDashboard.t(), atom(), map() | list()) ::
          T.domain_res(CommunityDashboard.t())
  def replace_section(%CommunityDashboard{} = community_dashboard, key, args) do
    with {:ok, section_payload} <- SectionPayload.prepare(community_dashboard, key, args) do
      ORM.replace_dsb_section(community_dashboard, key, section_payload)
    end
  end

  @spec ensure_exist(Community.t()) :: T.domain_res(CommunityDashboard.t())
  def ensure_exist(%Community{} = community) do
    Transaction.lock_global("community_dashboard:init:#{community.id}", fn ->
      case ORM.find_by(CommunityDashboard, community_id: community.id) do
        {:error, _} ->
          ORM.create(
            CommunityDashboard,
            %{community_id: community.id} |> Map.merge(@default_dashboard)
          )

        {:ok, community_dashboard} ->
          {:ok, community_dashboard}
      end
    end)
  end
end
