defmodule GroupherServer.CMS.Communities.Reader do
  @moduledoc """
  Reader helpers for communities.

  The same `fetch` entry point serves public viewers and explicit operations
  callers. Gate owns policy selection; this module owns query assembly,
  preloads, metadata and view bookkeeping.

  Business position:

      Client / reviewer
        -> CMS.Communities
        -> Reader
        -> Repo / Oban
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Gate
  alias CMS.Model.{Community, CommunityDashboard}
  alias Helper.{ORM, T}

  @default_dashboard CommunityDashboard.default()
  @default_read_opt [inc_views: true]

  @spec fetch(String.t(), keyword() | User.t() | :operations) :: T.domain_res(term())
  def fetch(slug, opt \\ @default_read_opt)

  def fetch(slug, %User{} = user), do: fetch_for_viewer(slug, user, @default_read_opt)
  def fetch(slug, :operations), do: do_fetch(slug, :operations, policy_mode: :operations)
  def fetch(slug, opt) when is_list(opt), do: do_fetch(slug, nil, opt)

  @spec fetch(String.t(), User.t() | :operations, keyword()) :: T.domain_res(term())
  def fetch(slug, %User{} = user, opt), do: fetch_for_viewer(slug, user, opt)

  def fetch(slug, :operations, opt),
    do: do_fetch(slug, :operations, Keyword.put_new(opt, :policy_mode, :operations))

  defp fetch_for_viewer(slug, user, opt) do
    with {:ok, community} <- do_fetch(slug, user, Keyword.put(opt, :inc_views, false)),
         {:ok, community} <- maybe_inc_views(community, opt) do
      viewer_has_states({:ok, community}, user)
    else
      {:error, :not_exist} -> {:error, {:not_exist, "Community"}}
      {:error, reason} -> {:error, reason}
    end
  end

  defp do_fetch(slug, actor, opt) do
    with query <- scoped_query(slug, actor, opt),
         {:ok, community} <- fetch_scoped(query),
         {:ok, community} <- ensure_community_with_dashboard(community),
         {:ok, community} <- read_moderators(community),
         {:ok, community} <- maybe_inc_views(community, opt) do
      {:ok, community}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp scoped_query(slug, actor, opt) do
    policy_mode = Keyword.get(opt, :policy_mode, :public)

    case Gate.scope(Community, actor, :read, %{policy_mode: policy_mode}) do
      %Ecto.Query{} = query ->
        where(query, [community], community.slug == ^slug or community.aka == ^slug)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp fetch_scoped({:error, reason}), do: {:error, reason}

  defp fetch_scoped(%Ecto.Query{} = query) do
    query
    |> preload([:dashboard, :lifecycle, moderators: [:community, :user]])
    |> Repo.one()
    |> done()
    |> case do
      {:ok, community} -> ORM.fill_meta(community)
      error -> error
    end
  end

  defp maybe_inc_views(community, opt) do
    case Keyword.get(opt, :inc_views) do
      true -> ORM.inc(community, :views)
      false -> {:ok, community}
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
end
