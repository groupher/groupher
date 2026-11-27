defmodule GroupherServer.CMS.Communities.Admins do
  @moduledoc """
  CMS capability facade for Community Admin membership and request operations.

      GraphQL input -> CMS -> Admins Query / Commands -> Passport and persistence
  """

  alias GroupherServer.{Accounts, CMS}
  alias CMS.FrontDesk
  alias Accounts.Model.User
  alias CMS.Communities.Admins.Query
  alias CMS.Communities.Admins.Requests.Commands.{Cancel, Create, Decide}
  alias CMS.Communities.Admins.Commands.{Remove, UpdatePermissions}
  alias CMS.Model.CommunityAdmin

  @doc "Returns bounded candidates after current Community Admin invitation authorization."
  def candidates(community_ref, name, %User{} = actor) when is_binary(name) do
    result =
      with {:ok, community} <- community(community_ref),
           {:ok, :pass} <- authorize_manager(actor, community),
           do: Query.candidates(community, name)

    case result do
      {:ok, candidates} -> {:ok, candidates}
      _ -> {:error, :permission_denied}
    end
  end

  def candidates(_, _, _), do: {:error, :permission_denied}

  @doc "Pages Community Admins after current invitation-management authorization."
  def page_admins(community_ref, pagi, %User{} = actor) do
    result =
      with {:ok, community} <- community(community_ref),
           {:ok, :pass} <- authorize_manager(actor, community),
           do: Query.page_admins(community, pagi)

    case result do
      {:ok, page} -> {:ok, page}
      _ -> {:error, :permission_denied}
    end
  end

  @doc "Pages public Admin membership identity projections for a readable Community."
  def page_members(community_ref, filter, pagi, actor) do
    with {:ok, community} <- readable_community(community_ref, actor) do
      Query.page(community, filter, pagi)
    end
  end

  @doc "Pages requests visible to the subject, creator, or current Community managers."
  def page_requests(community_ref, pagi, %User{} = actor) do
    with {:ok, community} <- community(community_ref) do
      is_manager = match?({:ok, :pass}, authorize_manager(actor, community))
      Query.page_requests(community, actor, is_manager, pagi)
    end
  end

  def page_requests(_, _, _), do: {:error, :permission_denied}

  @doc "Lists only the authenticated actor's own Community Admin memberships."
  def list_own_memberships(%User{} = actor), do: Query.own_memberships(actor)
  def list_own_memberships(_), do: {:error, :permission_denied}

  @doc "Creates an invitation or application from validated GraphQL values."
  def create(community_ref, subject_login, type, permissions, %User{} = actor, command_id) do
    with {:ok, community} <- community(community_ref),
         {:ok, subject} <- Query.request_subject(subject_login, type, actor),
         {:ok, request} <-
           Create.execute(community, subject, type, permissions, actor, command_id) do
      Query.present_request(request)
    end
  end

  @doc "Decides a request after loading its canonical Community and approved proposal."
  def decide(request_id, revision, decision, approved_permissions, %User{} = actor, command_id) do
    with {:ok, request, community} <- Query.request_context(request_id),
         {:ok, approved} <- decision_permissions(decision, approved_permissions, request),
         {:ok, result} <-
           Decide.execute(
             community,
             request.id,
             revision,
             decision,
             approved,
             actor,
             command_id
           ) do
      Query.present_request(result)
    end
  end

  @doc "Cancels a request after loading its canonical Community."
  def cancel(request_id, revision, %User{} = actor, command_id) do
    with {:ok, request, community} <- Query.request_context(request_id),
         {:ok, result} <- Cancel.execute(community, request.id, revision, actor, command_id) do
      Query.present_request(result)
    end
  end

  @doc "Updates a membership permission map and returns its public Admin projection."
  def update_permissions(
        community_ref,
        member_id,
        revision,
        permissions,
        %User{} = actor,
        command_id
      ) do
    with {:ok, community} <- community(community_ref),
         {:ok, member} <-
           UpdatePermissions.execute(
             community,
             member_id,
             revision,
             permissions,
             actor,
             command_id
           ) do
      {:ok, Query.present_admin(member)}
    end
  end

  @doc "Removes a selected Admin after validating the member identity."
  def remove(community_ref, member_id, revision, %User{} = actor, command_id) do
    with {:ok, community} <- community(community_ref) do
      case Remove.execute(community, member_id, revision, actor, command_id) do
        {:ok, :removed} -> {:ok, true}
        result -> result
      end
    end
  end

  @doc "Removes the actor's current ordinary Admin membership."
  def leave(community_ref, revision, %User{} = actor, command_id) do
    with {:ok, community} <- community(community_ref),
         {:ok, %CommunityAdmin{} = member} <- Query.current_member(community, actor) do
      case Remove.execute(community, member.id, revision, actor, command_id) do
        {:ok, :removed} -> {:ok, true}
        result -> result
      end
    else
      {:ok, nil} -> {:error, :admin_not_found}
      {:error, _reason} = error -> error
    end
  end

  @doc "Returns the actor's Admin projection for a readable Community, if present."
  def current(community_ref, %User{} = actor) do
    with {:ok, community} <- readable_community(community_ref, actor) do
      case Query.current_member(community, actor) do
        {:ok, nil} -> {:ok, nil}
        {:ok, member} -> {:ok, Query.present_admin(member, actor)}
        {:error, _} = error -> error
      end
    end
  end

  @doc "Reports whether the current actor can manage Community Admins."
  def management_allowed(community_ref, %User{} = actor) do
    case community(community_ref) do
      {:ok, community} -> {:ok, match?({:ok, :pass}, authorize_manager(actor, community))}
      _ -> {:ok, false}
    end
  end

  defp decision_permissions(:reject, _permissions, _request), do: {:ok, nil}

  defp decision_permissions(:accept, permissions, request) do
    value = permissions || request.proposed_permissions || %{}
    if is_map(value), do: {:ok, value}, else: {:error, :invalid_permissions}
  end

  defp authorize_manager(actor, community) do
    with {:ok, scope} <- CMS.Passport.load_community_scope(actor, community),
         {:ok, true} <- CMS.Passport.allowed?(actor, scope, "admin.invite") do
      {:ok, :pass}
    else
      _ -> {:error, :permission_denied}
    end
  end

  defp community(ref), do: FrontDesk.community({:ref, ref}, mode: :internal)

  defp readable_community(ref, actor) do
    case FrontDesk.community({:ref, ref}, actor, mode: :public) do
      {:ok, community} -> {:ok, community}
      {:error, _} -> FrontDesk.community({:ref, ref}, actor, mode: :admin)
    end
  end
end
