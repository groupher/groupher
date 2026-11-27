defmodule GroupherServer.CMS.Communities.Admins.Query do
  @moduledoc """
  Pages public Community Admin identity projections without exposing permission facts.

      readable Community -> CommunityAdmin page -> User display fields
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Accounts, Repo}
  alias Accounts.Model.User
  alias CMS.Model.{Community, CommunityAdmin, CommunityAdminRequest}
  alias Helper.ORM
  alias Helper.ORM.Pagi.Order

  @doc "Returns a paged, permission-free Admin membership projection for a readable Community."
  def page(%Community{id: community_id}, filter, pagi) when is_integer(community_id) do
    sort = Map.get(filter, :sort, :desc_inserted)
    direction = if sort == :asc_inserted, do: :asc, else: :desc

    query =
      from(admin in CommunityAdmin,
        where: admin.community_id == ^community_id,
        preload: [:user]
      )

    with true <- sort in [:asc_inserted, :desc_inserted],
         {:ok, page} <-
           ORM.pagi(query, pagi,
             for: CommunityAdmin,
             order: %Order{
               fields: [:inserted_at, :id],
               directions: [direction, direction],
               cursor_fields: [:inserted_at, :id]
             },
             surface: "communities.admin_members",
             query_fingerprint: :erlang.term_to_binary(community_id) |> Base.encode64()
           ) do
      {:ok, %{page | entries: Enum.map(page.entries, &present_member/1)}}
    else
      false -> {:error, GroupherServer.Pagi.unsupported_sort()}
      {:error, _reason} = error -> error
    end
  end

  def page(_, _, _), do: {:error, :invalid_community}

  @doc "Returns bounded invitation candidates excluding current members and pending requests."
  def candidates(%Community{id: community_id}, name)
      when is_integer(community_id) and is_binary(name) do
    members =
      from(admin in CommunityAdmin,
        where: admin.community_id == ^community_id,
        select: admin.user_id
      )

    pending =
      from(request in CommunityAdminRequest,
        where: request.community_id == ^community_id and request.status == :pending,
        select: request.subject_user_id
      )

    {:ok,
     Repo.all(
       from(user in User,
         where: user.id not in subquery(members) and user.id not in subquery(pending),
         where: ilike(user.login, ^"%#{name}%") or ilike(user.nickname, ^"%#{name}%"),
         order_by: [desc: user.id],
         limit: 15
       )
     )}
  end

  def candidates(_, _), do: {:error, :invalid_community}

  @doc "Pages Admin permission projections for a Community manager."
  def page_admins(%Community{id: community_id}, pagi) when is_integer(community_id) do
    query = from(admin in CommunityAdmin, where: admin.community_id == ^community_id)

    with {:ok, page} <-
           ORM.pagi(query, pagi,
             for: CommunityAdmin,
             order: %Order{
               fields: [:inserted_at, :id],
               directions: [:desc, :desc],
               cursor_fields: [:inserted_at, :id]
             },
             surface: "communities.admins",
             query_fingerprint: :erlang.term_to_binary(community_id) |> Base.encode64()
           ) do
      {:ok, %{page | entries: Enum.map(page.entries, &present_admin/1)}}
    end
  end

  def page_admins(_, _), do: {:error, :invalid_community}

  @doc "Pages request projections visible to the actor or current Community managers."
  def page_requests(%Community{id: community_id}, %User{} = actor, is_manager, pagi)
      when is_integer(community_id) and is_boolean(is_manager) do
    query =
      from(request in CommunityAdminRequest,
        where: request.community_id == ^community_id,
        where:
          ^is_manager or request.subject_user_id == ^actor.id or
            request.created_by_id == ^actor.id
      )

    with {:ok, page} <-
           ORM.pagi(query, pagi,
             for: CommunityAdminRequest,
             order: %Order{
               fields: [:inserted_at, :id],
               directions: [:desc, :desc],
               cursor_fields: [:inserted_at, :id]
             },
             surface: "communities.admin_requests",
             query_fingerprint:
               :erlang.term_to_binary({community_id, actor.id, is_manager}) |> Base.encode64()
           ) do
      {:ok, %{page | entries: Enum.map(page.entries, &present_request_data/1)}}
    end
  end

  def page_requests(_, _, _, _), do: {:error, :invalid_community}

  @doc "Loads a request and its canonical Community for the command facade."
  def request_context(id) do
    case Repo.get(CommunityAdminRequest, id) do
      %CommunityAdminRequest{} = request ->
        case Repo.get(Community, request.community_id) do
          %Community{} = community -> {:ok, request, community}
          nil -> {:error, :community_not_found}
        end

      nil ->
        {:error, :request_not_found}
    end
  end

  @doc "Resolves the invite subject by login or uses the actor for an application."
  def request_subject(login, :invite, _actor) when is_binary(login) do
    case Repo.get_by(User, login: login) do
      %User{} = user -> {:ok, user}
      nil -> {:error, :user_not_found}
    end
  end

  def request_subject(_login, _type, %User{} = actor), do: {:ok, actor}

  @doc "Loads one current Admin membership for the actor in a Community."
  def current_member(%Community{id: community_id}, %User{id: user_id}) do
    case Repo.get_by(CommunityAdmin, community_id: community_id, user_id: user_id) do
      %CommunityAdmin{} = member -> {:ok, member}
      nil -> {:ok, nil}
    end
  end

  def current_member(_, _), do: {:error, :invalid_community}

  @doc "Lists the authenticated actor's own Community Admin memberships."
  def own_memberships(%User{id: user_id}) when is_integer(user_id) do
    {:ok,
     Repo.all(
       from(a in CommunityAdmin,
         join: c in Community,
         on: c.id == a.community_id,
         where: a.user_id == ^user_id,
         select: %{
           member_id: a.id,
           community: c.slug,
           community_ref: c.ref,
           is_lord: a.is_lord,
           permissions: a.permissions,
           revision: a.revision
         }
       )
     )}
  end

  def own_memberships(_), do: {:error, :permission_denied}

  @doc "Lists pending Admin requests created by or addressed to the actor."
  def own_pending_requests(%User{id: user_id}) when is_integer(user_id) do
    {:ok,
     Repo.all(
       from(r in CommunityAdminRequest,
         where:
           r.status == :pending and (r.subject_user_id == ^user_id or r.created_by_id == ^user_id),
         select: %{
           id: r.id,
           revision: r.revision,
           subject_user_id: r.subject_user_id,
           created_by_id: r.created_by_id
         }
       )
     )}
  end

  def own_pending_requests(_), do: {:error, :permission_denied}

  @doc "Maps a CommunityAdmin row into its GraphQL-facing projection."
  def present_admin(%CommunityAdmin{} = admin) do
    %{
      member_id: admin.id,
      revision: admin.revision,
      is_lord: admin.is_lord,
      permissions: for({key, true} <- admin.permissions, do: key),
      user: Repo.get(User, admin.user_id)
    }
  end

  @doc "Projects an Admin membership using an already-loaded user record."
  def present_admin(%CommunityAdmin{} = admin, %User{} = user) do
    %{present_admin(admin) | user: user}
  end

  @doc "Maps an Admin request row and related identities into its GraphQL-facing projection."
  def present_request(%CommunityAdminRequest{} = request) do
    {:ok, present_request_data(request)}
  end

  @doc "Builds the request projection and loads the subject and requester identities."
  def present_request_data(%CommunityAdminRequest{} = request) do
    %{
      id: request.id,
      community_id: request.community_id,
      subject_user_id: request.subject_user_id,
      created_by_id: request.created_by_id,
      type: Atom.to_string(request.type),
      status: Atom.to_string(request.status),
      decision: if(request.decision, do: Atom.to_string(request.decision), else: nil),
      proposed_permissions: request.proposed_permissions,
      approved_permissions: request.approved_permissions,
      revision: request.revision,
      decided_by_id: request.decided_by_id,
      decided_at: request.decided_at,
      cancelled_by_id: request.cancelled_by_id,
      cancelled_at: request.cancelled_at,
      expires_at: request.expires_at,
      reason: request.reason,
      inserted_at: request.inserted_at,
      updated_at: request.updated_at,
      subject_user: Repo.get(User, request.subject_user_id),
      created_by: Repo.get(User, request.created_by_id)
    }
  end

  defp present_member(%CommunityAdmin{user: %User{} = user} = admin) do
    %{member_id: admin.id, user_id: admin.user_id, is_lord: admin.is_lord, user: user}
  end
end
