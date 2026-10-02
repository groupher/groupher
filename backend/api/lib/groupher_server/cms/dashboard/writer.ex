defmodule GroupherServer.CMS.Dashboard.Writer do
  @moduledoc """
  Mutation layer for persisted community dashboard sections.

  Dashboard updates arrive as GraphQL section payloads and are normalized before
  replacing the matching section on `CommunityDashboard`. Base-info writes are a
  special case because they must keep the community row and dashboard embed in
  sync. The standalone `content_shadow` flag is persisted directly as a scalar
  field; all embedded sections continue through `SectionPayload`. Dashboard
  creation is ensured before the write; `sync_base_info` and
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

  alias CMS.Communities.ErrorCat
  alias CMS.ErrorCat, as: CmsErrorCat
  alias CMS.Dashboard.{BaseInfo, SectionPayload}
  alias CMS.Model.{Community, CommunityDashboard}
  alias Helper.{ORM, T, Transaction}

  @default_dashboard CommunityDashboard.default()

  @doc "Updates the dashboard section named by the GraphQL `dsb_section` payload."
  @spec update(Community.t(), map()) :: T.domain_res(CommunityDashboard.t())
  def update(%Community{} = community, %{dsb_section: key} = args) do
    update(community, key, SectionPayload.section_args(key, args))
  end

  def update(%Community{}, _args),
    do: {:error, ErrorCat.invalid_dsb_section()}

  @doc "Updates one explicit dashboard section, including base-info synchronization."
  @spec update(Community.t(), atom(), map() | list() | boolean()) ::
          T.domain_res(CommunityDashboard.t())
  def update(%Community{} = community, :base_info, args) do
    with {:ok, community_dashboard} <- ensure_exist(community),
         {:ok, section_payload} <-
           SectionPayload.prepare(
             community_dashboard,
             :base_info,
             Map.merge(args, BaseInfo.take_community_fields(args))
           ) do
      Repo.transaction(fn ->
        with {:ok, updated_community} <-
               CMS.Communities.sync_base_info(community, args, :operations),
             {:ok, community_dashboard} <-
               ORM.replace_dsb_section(community_dashboard, :base_info, section_payload),
             :ok <- invalidate_public_presentation(updated_community.id) do
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

  @doc "Ensures a dashboard exists and replaces one non-base-info section."
  @spec update_section(Community.t(), atom(), map() | list() | boolean()) ::
          T.domain_res(CommunityDashboard.t())
  def update_section(%Community{} = community, key, args) do
    with {:ok, community_dashboard} <- ensure_exist(community) do
      replace_section(community_dashboard, key, args)
    end
  end

  @doc "Normalizes and persists one section on an existing dashboard."
  @spec replace_section(CommunityDashboard.t(), atom(), map() | list() | boolean()) ::
          T.domain_res(CommunityDashboard.t())
  def replace_section(%CommunityDashboard{} = community_dashboard, :content_shadow, enabled)
      when is_boolean(enabled) do
    Repo.transaction(fn ->
      with {:ok, updated} <-
             community_dashboard
             |> Ecto.Changeset.change(%{content_shadow: enabled})
             |> Repo.update(),
           :ok <- invalidate_public_presentation(community_dashboard.community_id) do
        updated
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  def replace_section(%CommunityDashboard{}, :content_shadow, _args),
    do: {:error, CmsErrorCat.custom("invalid dashboard content shadow")}

  def replace_section(%CommunityDashboard{} = community_dashboard, key, args) do
    with {:ok, section_payload} <- SectionPayload.prepare(community_dashboard, key, args) do
      Repo.transaction(fn ->
        with {:ok, updated} <- ORM.replace_dsb_section(community_dashboard, key, section_payload),
             :ok <- invalidate_public_presentation(community_dashboard.community_id) do
          updated
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  defp invalidate_public_presentation(community_id) do
    community = Repo.get!(Community, community_id)

    case CMS.Outbox.send(%{
           event: "community.presentation_changed",
           worker: CMS.Outbox.Workers.Community.Cleanup,
           resource_type: "community",
           resource_id: community.id,
           command_id: Ecto.UUID.generate(),
           data: %{community: community.slug, community_id: community.id}
         }) do
      {:ok, _event} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Returns the community dashboard, creating it once under a global lock when absent."
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
