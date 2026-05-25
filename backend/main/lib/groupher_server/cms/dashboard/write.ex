defmodule GroupherServer.CMS.Dashboard.Write do
  @moduledoc false

  alias GroupherServer.CMS.Dashboard.SectionPayload
  alias GroupherServer.CMS.Model.{Community, CommunityDashboard}
  alias Helper.{ORM, T, Transaction}

  @default_dashboard CommunityDashboard.default()

  @spec update(Community.t(), map()) :: T.domain_res(Community.t())
  def update(%Community{} = community, %{dsb_section: key} = args) do
    update(community, key, SectionPayload.section_args(key, args))
  end

  @spec update(Community.t(), atom(), map() | list()) :: T.domain_res(Community.t())
  def update(%Community{} = community, :base_info, args) do
    main_fields =
      Map.take(args, [:title, :locale, :desc, :logo, :favicon, :slug, :homepage])

    with {:ok, community} <- update_community_if_need(community, main_fields) do
      update_section(community, :base_info, Map.merge(args, main_fields))
    end
  end

  def update(%Community{} = community, key, args) do
    update_section(community, key, args)
  end

  @spec update_section(Community.t(), atom(), map() | list()) :: T.domain_res(Community.t())
  def update_section(%Community{} = community, key, args) do
    with {:ok, community_dashboard} <- ensure_exist(community),
         {:ok, _} <- replace_section(community_dashboard, key, args) do
      {:ok, community}
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

  # see https://elixirforum.com/t/pattern-match-on-empty-maps/33259/5
  defp update_community_if_need(%Community{} = community, fields) when map_size(fields) == 0 do
    {:ok, community}
  end

  defp update_community_if_need(%Community{} = community, fields) do
    ORM.update(community, fields)
  end
end
