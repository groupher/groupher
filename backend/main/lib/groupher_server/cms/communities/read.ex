defmodule GroupherServer.CMS.Communities.Read do
  @moduledoc """
  Read helpers for communities.
  """

  import Helper.Utils, only: [done: 1]

  alias Helper.ORM
  alias Helper.Types, as: T
  alias GroupherServer.{Accounts, Repo}
  alias Accounts.Model.User
  alias GroupherServer.CMS.Model.{Community, CommunityDashboard, Embeds}

  @default_dashboard CommunityDashboard.default()
  @default_read_opt [inc_views: true]

  @spec read(String.t(), keyword()) :: T.domain_res(term())
  def read(slug, opt \\ @default_read_opt)

  def read(slug, %User{} = user) do
    read(slug, @default_read_opt) |> viewer_has_states(user)
  end

  def read(slug, opt), do: do_read(slug, opt)

  def read(slug, %User{} = user, opt) do
    read(slug, opt) |> viewer_has_states(user)
  end

  @doc """
  check if community exist
  """
  @spec exist?(String.t()) :: T.domain_res(term())
  def exist?(slug) do
    case ORM.find_by(Community, slug: slug) do
      {:ok, _} -> {:ok, %{exist: true}}
      {:error, _} -> {:ok, %{exist: false}}
    end
  end

  defp do_read(slug, opt) do
    with {:ok, community} <- ORM.find_community(slug),
         {:ok, community} <- ensure_community_with_dashboard(community),
         {:ok, community} <- ORM.fill_meta(community),
         {:ok, community} <- read_moderators(community) do
      case get_in(opt, [:inc_views]) do
        true -> ORM.inc(community, :views)
        false -> {:ok, community}
      end
    end
  end

  defp read_moderators(%Community{} = community) do
    community |> Map.merge(%{moderators: community.moderators}) |> done
  end

  defp ensure_community_with_dashboard(%Community{dashboard: nil} = community) do
    community
    |> Ecto.Changeset.change()
    |> Ecto.Changeset.put_assoc(:dashboard, @default_dashboard)
    |> Repo.update()
  end

  defp ensure_community_with_dashboard(%Community{} = community), do: {:ok, community}

  defp viewer_has_states({:ok, community}, %User{id: user_id}) do
    viewer_has_states = %{
      viewer_has_subscribed: user_id in community.meta.subscribed_user_ids,
      viewer_is_moderator: user_id in community.meta.moderators_ids
    }

    {:ok, Map.merge(community, viewer_has_states)}
  end

  defp viewer_has_states({:error, reason}, _user), do: {:error, reason}
end
