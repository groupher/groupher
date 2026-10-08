defmodule GroupherServer.CMS.Communities.Persist do
  @moduledoc """
  Owns Community row mechanics inside an existing domain transaction.

      Community command
        -> CMS.Gate community lock
        -> Communities.Persist
        -> Community row / Outbox intent

  This module does not authorize actors, transition Lifecycle, or open a
  transaction of its own.
  """

  alias GroupherServer.CMS
  alias CMS.Dashboard.BaseInfo
  alias CMS.Model.Community
  alias Helper.{ORM, T}

  @doc """
  Updates only Community identity fields mirrored by dashboard base-info.

  ## Examples

      update_identity_fields(...)
      #=> {:ok, value}
  """
  @spec update_identity_fields(Community.t(), map()) :: T.domain_res(Community.t())
  def update_identity_fields(%Community{} = community, args) do
    args = BaseInfo.take_community_fields(args)

    case map_size(args) do
      0 ->
        {:ok, community}

      _ ->
        ORM.update(community, args)
    end
  end

  @doc """
  Updates Community fields without performing a second Gate check.

  ## Examples

      update_fields(...)
      #=> {:ok, value}
  """
  @spec update_fields(Community.t(), map()) :: T.domain_res(Community.t())
  def update_fields(%Community{} = community, args), do: ORM.update(community, args)

  @doc """
  Inserts the core Community row for a create command.

  ## Examples

      insert_core(...)
      #=> {:ok, value}
  """
  @spec insert_core(map(), term()) :: T.domain_res(Community.t())
  def insert_core(args, actor) do
    with {:ok, author} <- CMS.Articles.Writer.ensure_author_exists(actor) do
      args =
        args
        |> Map.merge(%{user_id: author.user_id})
        |> Map.merge(default_settings())

      ORM.create(Community, args)
    end
  end

  defp default_settings do
    %{
      meta: CMS.Model.Embeds.CommunityMeta.default_meta(),
      dashboard: CMS.Model.CommunityDashboard.default()
    }
  end
end
