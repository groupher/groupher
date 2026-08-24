defmodule GroupherServer.CMS.Dashboard.Writer do
  @moduledoc """
  Mutation layer for persisted community dashboard sections.

  Dashboard updates arrive as GraphQL section payloads and are normalized before
  replacing the matching section on `CommunityDashboard`. Base-info writes are a
  special case because they must keep the community row and dashboard embed in
  sync. Dashboard creation is ensured before the write; `sync_base_info` and
  `ORM.replace_dsb_section` then run inside one transaction.

      CMS resolver
          |
          v
      Dashboard.Writer.update/2
          |
          +--> ensure CommunityDashboard exists
          +--> SectionPayload.prepare/3
          +--> ORM.replace_dsb_section/3

  Use this module for write orchestration only. Section-specific validation and
  merge rules should stay in `SectionPayload`, `LinkValidator`, or focused
  section helpers.
  """

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.CMS.Communities.ErrorCat
  alias GroupherServer.CMS.Dashboard.{BaseInfo, SectionPayload}
  alias GroupherServer.CMS.Model.{Community, CommunityDashboard}
  alias Helper.{ORM, T, Transaction}

  @default_dashboard CommunityDashboard.default()

  @spec update(Community.t(), map()) :: T.domain_res(CommunityDashboard.t())
  @doc "Updates the dashboard section named by the GraphQL `dsb_section` payload."
  def update(%Community{} = community, %{dsb_section: key} = args) do
    update(community, key, SectionPayload.section_args(key, args))
  end

  def update(%Community{}, _args),
    do: {:error, ErrorCat.invalid_dsb_section()}

  @spec update(Community.t(), atom(), map() | list()) :: T.domain_res(CommunityDashboard.t())
  @doc "Updates one explicit dashboard section, including base-info synchronization."
  def update(%Community{} = community, :base_info, args) do
    with {:ok, community_dashboard} <- ensure_exist(community),
         {:ok, section_payload} <-
           SectionPayload.prepare(
             community_dashboard,
             :base_info,
             Map.merge(args, BaseInfo.take_community_fields(args))
           ) do
      Repo.transaction(fn ->
        with {:ok, _community} <- CMS.Communities.sync_base_info(community, args, :operations),
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
  @doc "Ensures a dashboard exists and replaces one non-base-info section."
  def update_section(%Community{} = community, key, args) do
    with {:ok, community_dashboard} <- ensure_exist(community) do
      replace_section(community_dashboard, key, args)
    end
  end

  @spec replace_section(CommunityDashboard.t(), atom(), map() | list()) ::
          T.domain_res(CommunityDashboard.t())
  @doc "Normalizes and persists one section on an existing dashboard."
  def replace_section(%CommunityDashboard{} = community_dashboard, key, args) do
    with {:ok, section_payload} <- SectionPayload.prepare(community_dashboard, key, args) do
      ORM.replace_dsb_section(community_dashboard, key, section_payload)
    end
  end

  @spec ensure_exist(Community.t()) :: T.domain_res(CommunityDashboard.t())
  @doc "Returns the community dashboard, creating it once under a global lock when absent."
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
