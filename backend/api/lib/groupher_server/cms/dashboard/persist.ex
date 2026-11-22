defmodule GroupherServer.CMS.Dashboard.Persist do
  @moduledoc """
  Owns dashboard database mechanics inside a caller-owned transaction.

  This module creates or updates `CommunityDashboard` rows, but does not decide
  authorization, lifecycle policy, transaction ownership, or receipt behavior.

      Dashboard.Command
        -> CMS.Gate community lock
        -> Dashboard.Persist
        -> CommunityDashboard
  """

  import Ecto.Query, only: [from: 2]

  alias GroupherServer.{CMS, Repo}
  alias CMS.Dashboard.{PagiMode, SectionPayload}
  alias CMS.Model.{Community, CommunityDashboard}
  alias Helper.{ORM, T}

  @default_dashboard CommunityDashboard.default()

  @doc """
  Returns the Community dashboard, inserting its default row when absent.

  ## Examples

      Dashboard.Persist.get_or_insert_dashboard(community)
      #=> {:ok, %CommunityDashboard{}} | {:error, reason}
  """
  @spec get_or_insert_dashboard(Community.t()) :: T.domain_res(CommunityDashboard.t())
  def get_or_insert_dashboard(%Community{} = community) do
    case ORM.find_by(CommunityDashboard, community_id: community.id) do
      {:ok, dashboard} ->
        {:ok, dashboard}

      {:error, _} ->
        ORM.create(
          CommunityDashboard,
          %{community_id: community.id} |> Map.merge(@default_dashboard)
        )
    end
  end

  @doc """
  Prepares and replaces one dashboard section on an existing row.

  ## Examples

      CMS.Dashboard.Persist.replace_section(dashboard, :base_info, %{title: "Groupher"})
      #=> {:ok, value}
  """
  @spec replace_section(CommunityDashboard.t(), atom(), map() | list() | boolean()) ::
          T.domain_res(CommunityDashboard.t())
  def replace_section(%CommunityDashboard{id: id}, :enable, args) do
    dashboard =
      from(d in CommunityDashboard, where: d.id == ^id, lock: "FOR UPDATE") |> Repo.one!()

    with {:ok, payload} <- SectionPayload.prepare(dashboard, :enable, args) do
      ORM.replace_dsb_section(dashboard, :enable, payload)
    end
  end

  def replace_section(%CommunityDashboard{} = dashboard, key, args) do
    with {:ok, payload} <- SectionPayload.prepare(dashboard, key, args) do
      ORM.replace_dsb_section(dashboard, key, payload)
    end
  end

  @doc """
  Atomically updates desktop and mobile Pagi modes when the expected revision matches.

  ## Examples

      CMS.Dashboard.Persist.update_pagi_mode(dashboard, :page, :infinite_scroll, dashboard.pagi_revision)
  """
  def update_pagi_mode(%CommunityDashboard{id: id}, mode, mobile_mode, expected_revision) do
    dashboard =
      from(d in CommunityDashboard, where: d.id == ^id, lock: "FOR UPDATE") |> Repo.one!()

    with {:ok, mode} <- PagiMode.normalize(mode),
         {:ok, mobile_mode} <- PagiMode.normalize(mobile_mode),
         true <- is_integer(expected_revision) and expected_revision == dashboard.pagi_revision do
      dashboard
      |> Ecto.Changeset.change(%{
        pagi_mode: mode,
        pagi_mobile_mode: mobile_mode,
        pagi_revision: dashboard.pagi_revision + 1
      })
      |> Repo.update()
    else
      false -> {:error, GroupherServer.Pagi.config_mismatch(%{mismatch: :revision})}
      {:error, _} = error -> error
    end
  end

  @doc """
  Reads an existing dashboard row without creating one for a read path.

  ## Examples

      CMS.Dashboard.Persist.get_dashboard(community)
      #=> {:ok, value}
  """
  @spec get_dashboard(Community.t()) :: T.domain_res(CommunityDashboard.t())
  def get_dashboard(%Community{} = community) do
    ORM.find_by(CommunityDashboard, community_id: community.id)
  end

  @doc """
  Updates the scalar dashboard content-shadow flag in the caller transaction.

  ## Examples

      CMS.Dashboard.Persist.update_content_shadow(dashboard, true)
      #=> {:ok, value}
  """
  @spec update_content_shadow(CommunityDashboard.t(), boolean()) ::
          T.domain_res(CommunityDashboard.t())
  def update_content_shadow(%CommunityDashboard{} = dashboard, enabled)
      when is_boolean(enabled) do
    dashboard
    |> Ecto.Changeset.change(%{content_shadow: enabled})
    |> Repo.update()
  end

  @doc """
  Stores the provider website identity on a dashboard row.

  The caller owns any surrounding transaction; the function only performs the
  CMS dashboard row primitive required by the Analysis Web provisioning flow.

  ## Examples

      CMS.Dashboard.Persist.update_website_id(dashboard, "website-id")
  """
  @spec update_website_id(CommunityDashboard.t(), String.t()) ::
          T.domain_res(CommunityDashboard.t())
  def update_website_id(%CommunityDashboard{} = dashboard, website_id)
      when is_binary(website_id) do
    dashboard
    |> Ecto.Changeset.change(%{umami_website_id: website_id})
    |> Repo.update()
  end
end
