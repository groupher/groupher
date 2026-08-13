defmodule GroupherServer.CMS.Communities.Read do
  @moduledoc """
  Read helpers for communities.

  The default scope is the single public-read boundary for Community queries.
  Internal and management callers must opt into `scope_all/1` explicitly.

  Business position:

      Client / reviewer
        -> CMS.Communities
        -> Read
        -> Repo / Oban
  """

  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Gate
  alias CMS.FrontDesk
  alias CMS.Model.{Community, CommunityDashboard, CommunityLifecycle}
  alias Helper.{ORM, T}

  @default_dashboard CommunityDashboard.default()
  @default_read_opt [inc_views: true]
  @community_normal Helper.Constant.CMS.pending(:normal)
  @public_lifecycle_states [:active, :read_only]

  @doc "Restricts a Community query to the current default public-read states."
  @spec scope(Ecto.Queryable.t()) :: Ecto.Query.t()
  def scope(queryable \\ Community) do
    from(community in queryable,
      left_join: lifecycle in CommunityLifecycle,
      on: lifecycle.community_id == community.id,
      where:
        lifecycle.state in ^@public_lifecycle_states or
          (is_nil(lifecycle.id) and community.pending == ^@community_normal)
    )
  end

  @doc "Returns an unfiltered Community query for explicit internal or management reads."
  @spec scope_all(Ecto.Queryable.t()) :: Ecto.Query.t()
  def scope_all(queryable \\ Community), do: from(community in queryable)

  @doc "Checks a preloaded Community against the same default public-read policy."
  @spec public?(Community.t()) :: boolean()
  def public?(%Community{lifecycle: %CommunityLifecycle{state: state}}),
    do: state in @public_lifecycle_states

  def public?(%Community{lifecycle: nil, pending: @community_normal}), do: true
  def public?(%Community{}), do: false

  @spec read(String.t(), keyword() | User.t()) :: T.domain_res(term())
  def read(slug, opt \\ @default_read_opt)

  def read(slug, %User{} = user), do: read_for_viewer(slug, user, @default_read_opt)

  def read(slug, opt), do: do_read(slug, opt)

  @doc "Reads a Community without applying the public Lifecycle scope."
  @spec read_all(String.t(), keyword()) :: T.domain_res(Community.t())
  def read_all(slug, opt \\ @default_read_opt), do: do_read_all(slug, opt)

  @spec read(String.t(), User.t(), keyword()) :: T.domain_res(term())
  def read(slug, %User{} = user, opt) do
    read_for_viewer(slug, user, opt)
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
    with {:ok, community} <- FrontDesk.community(slug),
         {:ok, community} <- ensure_community_with_dashboard(community),
         {:ok, community} <- read_moderators(community) do
      case get_in(opt, [:inc_views]) do
        true -> ORM.inc(community, :views)
        false -> {:ok, community}
      end
    end
  end

  defp read_for_viewer(slug, user, opt) do
    with {:ok, community} <- do_read_all(slug, Keyword.put(opt, :inc_views, false)),
         {:ok, true} <- Gate.can(user, :read, community),
         {:ok, community} <- maybe_inc_views(community, opt) do
      viewer_has_states({:ok, community}, user)
    else
      {:ok, false} -> {:error, {:not_exist, "Community"}}
      {:error, :not_exist} -> {:error, {:not_exist, "Community"}}
      {:error, reason} -> {:error, reason}
    end
  end

  defp maybe_inc_views(community, opt) do
    case get_in(opt, [:inc_views]) do
      true -> ORM.inc(community, :views)
      false -> {:ok, community}
    end
  end

  defp do_read_all(slug, opt) do
    Community
    |> scope_all()
    |> where([community], community.slug == ^slug or community.aka == ^slug)
    |> preload([:dashboard, :lifecycle, moderators: [:community, :user]])
    |> Repo.one()
    |> done()
    |> case do
      {:ok, community} ->
        with {:ok, community} <- ORM.fill_meta(community),
             {:ok, community} <- ensure_community_with_dashboard(community),
             {:ok, community} <- read_moderators(community) do
          case get_in(opt, [:inc_views]) do
            true -> ORM.inc(community, :views)
            false -> {:ok, community}
          end
        end

      {:error, _} = error ->
        error
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
