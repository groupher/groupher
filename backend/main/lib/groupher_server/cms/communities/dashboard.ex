defmodule GroupherServer.CMS.Communities.Dashboard do
  @moduledoc """
  Dashboard helpers for communities.
  """

  alias GroupherServer.CMS

  alias CMS.Model.{Community, CommunityDashboard}
  alias Helper.Types, as: T
  alias Helper.{ORM, OSS}

  @default_dashboard CommunityDashboard.default()

  @doc """
  update dashboard settings of a community
  """
  @spec update(Community.t(), atom(), map()) :: T.domain_res(Community.t())
  def update(%Community{} = community, :base_info, args) do
    main_fields =
      Map.take(args, [:title, :locale, :desc, :logo, :favicon, :slug, :homepage])
      |> OSS.persist_file(:logo)
      |> OSS.persist_file(:favicon)

    with {:ok, community} <- update_community_if_need(community, main_fields) do
      do_update(community, :base_info, Map.merge(args, main_fields))
    end
  end

  def update(%Community{} = community, key, args) do
    do_update(community, key, args)
  end

  defp do_update(%Community{} = community, key, args) do
    with {:ok, community_dashboard} <- ensure_exist(community),
         {:ok, _} <- ORM.update_dashboard(community_dashboard, key, args) do
      {:ok, community}
    end
  end

  defp ensure_exist(%Community{} = community) do
    case ORM.find_by(CommunityDashboard, community_id: community.id) do
      {:error, _} ->
        ORM.create(
          CommunityDashboard,
          %{community_id: community.id} |> Map.merge(@default_dashboard)
        )

      {:ok, community_dashboard} ->
        {:ok, community_dashboard}
    end
  end

  # see https://elixirforum.com/t/pattern-match-on-empty-maps/33259/5
  defp update_community_if_need(%Community{} = community, fields) when map_size(fields) == 0 do
    {:ok, community}
  end

  defp update_community_if_need(%Community{} = community, fields) do
    ORM.update(community, fields)
  end
end
