defmodule GroupherServerWeb.Resolvers.CMS.CommunityAdmins do
  @moduledoc """
  Resolves Passport-backed Community Admin membership and request operations.

      GraphQL Community Admin -> scoped Admin facts / request Commands
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Pagi, Repo}
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.{Community, CommunityAdmin, CommunityAdminRequest}
  alias GroupherServer.CMS.Communities.Admins.Requests.Commands.{Cancel, Create, Decide}
  alias GroupherServer.CMS.Communities.Admins.Query
  alias GroupherServer.CMS.Communities.Admins.Commands.UpdatePermissions
  alias GroupherServer.CMS.Communities.Admins.Commands.Remove
  alias Helper.ORM
  alias Helper.ORM.Pagi.Order

  def candidates(_root, %{community: community, name: name}, %{context: %{cur_user: actor}}) do
    with {:ok, community} <- resolve_community(community),
         {:ok, scope} <- CMS.Passport.load_community_scope(actor, community),
         {:ok, true} <- CMS.Passport.allowed?(actor, scope, "admin.invite") do
      members =
        from(a in CommunityAdmin, where: a.community_id == ^community.id, select: a.user_id)

      pending =
        from(r in CommunityAdminRequest,
          where: r.community_id == ^community.id and r.status == :pending,
          select: r.subject_user_id
        )

      {:ok,
       Repo.all(
         from(u in User,
           where: u.id not in subquery(members) and u.id not in subquery(pending),
           where: ilike(u.login, ^"%#{name}%") or ilike(u.nickname, ^"%#{name}%"),
           order_by: [desc: u.id],
           limit: 15
         )
       )}
    else
      _ -> {:error, :permission_denied}
    end
  end

  def admins(_root, %{community: community} = args, %{context: %{cur_user: actor}}) do
    with {:ok, community} <- resolve_community(community),
         {:ok, scope} <- CMS.Passport.load_community_scope(actor, community),
         {:ok, true} <- CMS.Passport.allowed?(actor, scope, "admin.invite"),
         {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      query = from(a in CommunityAdmin, where: a.community_id == ^community.id)

      with {:ok, page} <-
             ORM.pagi(query, pagi,
               for: CommunityAdmin,
               order: %Order{
                 fields: [:inserted_at, :id],
                 directions: [:desc, :desc],
                 cursor_fields: [:inserted_at, :id]
               },
               surface: "communities.admins",
               query_fingerprint: :erlang.term_to_binary(community.id) |> Base.encode64()
             ) do
        entries =
          Enum.map(page.entries, fn a ->
            %{
              member_id: a.id,
              revision: a.revision,
              is_lord: a.is_lord,
              permissions: for({key, true} <- a.permissions, do: key),
              user: Repo.get(User, a.user_id)
            }
          end)

        {:ok, %{page | entries: entries}}
      end
    else
      _ -> {:error, :permission_denied}
    end
  end

  def members(_root, %{community: ref} = args, %{context: context}) do
    actor = Map.get(context, :cur_user)

    with {:ok, community} <- readable_community(ref, actor),
         {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      Query.page(community, Map.get(args, :filter) || %{}, pagi)
    end
  end

  def requests(_root, %{community: community} = args, %{context: %{cur_user: actor}}) do
    with {:ok, community} <- resolve_community(community),
         {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      is_manager =
        case CMS.Passport.load_community_scope(actor, community) do
          {:ok, scope} -> CMS.Passport.allowed?(actor, scope, "admin.invite") == {:ok, true}
          _ -> false
        end

      query =
        from(r in CommunityAdminRequest,
          where: r.community_id == ^community.id,
          where: ^is_manager or r.subject_user_id == ^actor.id or r.created_by_id == ^actor.id
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
                 :erlang.term_to_binary({community.id, actor.id, is_manager}) |> Base.encode64()
             ) do
        entries = Enum.map(page.entries, &present_request_data/1)
        {:ok, %{page | entries: entries}}
      end
    end
  end

  def create(_root, args, %{context: %{cur_user: actor}}) do
    with {:ok, community} <- resolve_community(args.community),
         {:ok, subject} <- request_subject(args, actor),
         type <- request_type(args.type),
         {:ok, permissions} <- permission_map(args.permissions),
         {:ok, request} <-
           Create.execute(community, subject, type, permissions, actor, args.command_id) do
      present_request(request)
    end
  end

  def decide(_root, args, %{context: %{cur_user: actor}}) do
    with {:ok, request} <- find_request(args.request_id),
         %Community{} = community <- Repo.get(Community, request.community_id),
         decision <- decision(args.decision),
         {:ok, approved} <- decision_permissions(decision, args, request),
         {:ok, result} <-
           Decide.execute(
             community,
             request.id,
             args.revision,
             decision,
             approved,
             actor,
             args.command_id
           ) do
      present_request(result)
    end
  end

  def cancel(_root, args, %{context: %{cur_user: actor}}) do
    with {:ok, request} <- find_request(args.request_id),
         %Community{} = community <- Repo.get(Community, request.community_id),
         {:ok, result} <-
           Cancel.execute(community, request.id, args.revision, actor, args.command_id) do
      present_request(result)
    end
  end

  def update_permissions(_root, args, %{context: %{cur_user: actor}}) do
    with {:ok, community} <- resolve_community(args.community),
         {:ok, member_id} <- parse_integer_id(args.member_id),
         {:ok, member} <-
           UpdatePermissions.execute(
             community,
             member_id,
             args.revision,
             args.permissions,
             actor,
             args.command_id
           ),
         %User{} = user <- Repo.get(User, member.user_id) do
      {:ok,
       %{
         member_id: member.id,
         revision: member.revision,
         is_lord: member.is_lord,
         permissions: for({key, true} <- member.permissions, do: key),
         user: user
       }}
    end
  end

  def remove(_root, args, %{context: %{cur_user: actor}}) do
    with {:ok, community} <- resolve_community(args.community),
         {:ok, member_id} <- parse_integer_id(args.member_id) do
      Remove.execute(community, member_id, args.revision, actor, args.command_id)
    end
  end

  def leave(_root, args, %{context: %{cur_user: actor}}) do
    with {:ok, community} <- resolve_community(args.community),
         %CommunityAdmin{} = member <-
           Repo.get_by(CommunityAdmin, community_id: community.id, user_id: actor.id) do
      Remove.execute(community, member.id, args.revision, actor, args.command_id)
    else
      nil -> {:error, :admin_not_found}
      {:error, _} = error -> error
    end
  end

  def current(_root, %{community: ref}, %{context: %{cur_user: actor}}) do
    with {:ok, community} <- readable_community(ref, actor) do
      case Repo.get_by(CommunityAdmin, community_id: community.id, user_id: actor.id) do
        nil ->
          {:ok, nil}

        member ->
          {:ok,
           %{
             member_id: member.id,
             revision: member.revision,
             is_lord: member.is_lord,
             permissions: for({key, true} <- member.permissions, do: key),
             user: actor
           }}
      end
    end
  end

  def management_allowed(_root, %{community_ref: ref}, %{context: %{cur_user: actor}}) do
    with {:ok, community} <- resolve_community(ref),
         {:ok, scope} <- CMS.Passport.load_community_scope(actor, community) do
      {:ok, CMS.Passport.allowed?(actor, scope, "admin.invite") == {:ok, true}}
    else
      _ -> {:ok, false}
    end
  end

  defp resolve_community(%Community{} = community), do: {:ok, community}
  defp resolve_community(ref), do: CMS.front_desk_community(ref, mode: :internal)

  defp readable_community(ref, actor) do
    case CMS.front_desk_community(ref, actor, mode: :public) do
      {:ok, community} -> {:ok, community}
      {:error, _} -> CMS.front_desk_community(ref, actor, mode: :management)
    end
  end

  defp request_subject(%{type: type, subject_login: login}, _actor)
       when type in [:invite, "invite"] and is_binary(login) do
    case Repo.get_by(User, login: login) do
      nil -> {:error, :user_not_found}
      user -> {:ok, user}
    end
  end

  defp request_subject(_args, actor), do: {:ok, actor}
  defp request_type(type) when type in [:invite, "invite"], do: :invite
  defp request_type(_), do: :apply
  defp decision(value) when value in [:accept, "accept"], do: :accept
  defp decision(_), do: :reject
  defp decision_permissions(:reject, _args, _request), do: {:ok, nil}

  defp decision_permissions(:accept, args, request),
    do:
      permission_map(Map.get(args, :approved_permissions) || request.proposed_permissions || %{})

  defp permission_map(map) when is_map(map), do: {:ok, map}
  defp permission_map(_), do: {:error, :invalid_permissions}
  defp parse_integer_id(id) when is_integer(id), do: {:ok, id}

  defp parse_integer_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {value, ""} -> {:ok, value}
      _ -> {:error, :invalid_member_id}
    end
  end

  defp find_request(id) do
    case Repo.get(CommunityAdminRequest, id) do
      nil -> {:error, :request_not_found}
      row -> {:ok, row}
    end
  end

  defp present_request(request), do: {:ok, present_request_data(request)}

  defp present_request_data(request) do
    Map.merge(Map.from_struct(request), %{
      type: Atom.to_string(request.type),
      status: Atom.to_string(request.status),
      decision: if(request.decision, do: Atom.to_string(request.decision), else: nil),
      subject_user: Repo.get(User, request.subject_user_id),
      created_by: Repo.get(User, request.created_by_id)
    })
  end
end
