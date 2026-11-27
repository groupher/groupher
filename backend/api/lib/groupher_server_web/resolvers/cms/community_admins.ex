defmodule GroupherServerWeb.Resolvers.CMS.CommunityAdmins do
  @moduledoc """
  Resolves GraphQL input for Passport-backed Community Admin operations.

      GraphQL input validation -> CMS Community Admin facade
  """

  alias GroupherServer.{Accounts, CMS, Pagi}
  alias Accounts.Model.User

  @doc "Finds community admin candidates by name on behalf of the signed-in actor."
  def candidates(_root, %{community_ref: ref, name: name}, %{context: %{cur_user: actor}}) do
    CMS.search_community_admin_candidates(ref, name, actor)
  end

  @doc "Pages administrators for the community identified by its reference."
  def admins(_root, %{community_ref: ref} = args, %{context: %{cur_user: actor}}) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CMS.page_community_admins(ref, pagi, actor)
    end
  end

  @doc "Pages community members using the supplied filter and optional viewer."
  def members(_root, %{community_ref: ref} = args, %{context: context}) do
    actor = Map.get(context, :cur_user)

    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CMS.page_community_admin_memberships(ref, Map.get(args, :filter) || %{}, pagi, actor)
    end
  end

  @doc "Pages admin membership requests for the specified community and actor."
  def requests(_root, %{community_ref: ref} = args, %{context: %{cur_user: actor}}) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CMS.page_community_admin_requests(ref, pagi, actor)
    end
  end

  @doc "Creates an admin invitation or application after validating its permission map."
  def create(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    with {:ok, permissions} <- permission_map(args.permissions) do
      CMS.create_community_admin_request(
        args.community_ref,
        Map.get(args, :subject_login),
        request_type(args.type),
        permissions,
        actor,
        args.command_id
      )
    end
  end

  @doc "Accepts or rejects the specified request revision; only acceptance uses approved permissions."
  def decide(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    with {:ok, decision} <- decision(args.decision),
         {:ok, permissions} <- decision_permission_input(decision, args) do
      CMS.decide_community_admin_request(
        args.request_id,
        args.revision,
        decision,
        permissions,
        actor,
        args.command_id
      )
    end
  end

  @doc "Cancels the admin request at the supplied revision for the signed-in actor."
  def cancel(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.cancel_community_admin_request(args.request_id, args.revision, actor, args.command_id)
  end

  @doc "Updates a member's permissions after validating the member ID and permission map."
  def update_permissions(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    with {:ok, member_id} <- parse_integer_id(args.member_id),
         {:ok, permissions} <- permission_map(args.permissions) do
      CMS.update_community_admin_permissions(
        args.community_ref,
        member_id,
        args.revision,
        permissions,
        actor,
        args.command_id
      )
    end
  end

  @doc "Removes an admin member by integer ID at the supplied membership revision."
  def remove(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    with {:ok, member_id} <- parse_integer_id(args.member_id) do
      CMS.remove_community_admin(
        args.community_ref,
        member_id,
        args.revision,
        actor,
        args.command_id
      )
    end
  end

  @doc "Ends the actor's own admin membership at the supplied revision."
  def leave(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.leave_community_admin_role(args.community_ref, args.revision, actor, args.command_id)
  end

  @doc "Reads the signed-in actor's current admin status in the identified community."
  def current(_root, %{community_ref: ref}, %{context: %{cur_user: %User{} = actor}}) do
    CMS.get_current_community_admin_membership(ref, actor)
  end

  @doc "Checks whether the actor may manage admins in the identified community."
  def management_allowed(_root, %{community_ref: ref}, %{context: %{cur_user: %User{} = actor}}) do
    CMS.check_community_admin_management_access(ref, actor)
  end

  defp request_type(type) when type in [:invite, "invite"], do: :invite
  defp request_type(_), do: :apply
  defp decision(value) when value in [:accept, "accept"], do: {:ok, :accept}
  defp decision(value) when value in [:reject, "reject"], do: {:ok, :reject}
  defp decision(_), do: {:error, :invalid_request_decision}

  defp permission_map(map) when is_map(map), do: {:ok, map}
  defp permission_map(_), do: {:error, :invalid_permissions}

  defp decision_permission_input(:reject, _args), do: {:ok, nil}

  defp decision_permission_input(:accept, args) do
    case Map.get(args, :approved_permissions) do
      nil -> {:ok, nil}
      permissions -> permission_map(permissions)
    end
  end

  defp parse_integer_id(id) when is_integer(id), do: {:ok, id}

  defp parse_integer_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {value, ""} -> {:ok, value}
      _ -> {:error, :invalid_member_id}
    end
  end

  defp parse_integer_id(_), do: {:error, :invalid_member_id}
end
