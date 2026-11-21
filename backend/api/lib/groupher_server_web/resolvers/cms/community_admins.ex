defmodule GroupherServerWeb.Resolvers.CMS.CommunityAdmins do
  @moduledoc """
  Resolves GraphQL input for Passport-backed Community Admin operations.

      GraphQL input validation -> CMS Community Admin facade
  """

  alias GroupherServer.{Accounts, CMS, Pagi}
  alias Accounts.Model.User

  def candidates(_root, %{community_ref: ref, name: name}, %{context: %{cur_user: actor}}) do
    CMS.communities_admins_candidates(ref, name, actor)
  end

  def admins(_root, %{community_ref: ref} = args, %{context: %{cur_user: actor}}) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CMS.communities_admins_page(ref, pagi, actor)
    end
  end

  def members(_root, %{community_ref: ref} = args, %{context: context}) do
    actor = Map.get(context, :cur_user)

    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CMS.communities_admins_members(ref, Map.get(args, :filter) || %{}, pagi, actor)
    end
  end

  def requests(_root, %{community_ref: ref} = args, %{context: %{cur_user: actor}}) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CMS.communities_admins_requests(ref, pagi, actor)
    end
  end

  def create(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    with {:ok, permissions} <- permission_map(args.permissions) do
      CMS.communities_admins_create(
        args.community_ref,
        Map.get(args, :subject_login),
        request_type(args.type),
        permissions,
        actor,
        args.command_id
      )
    end
  end

  def decide(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    with {:ok, decision} <- decision(args.decision),
         {:ok, permissions} <- decision_permission_input(decision, args) do
      CMS.communities_admins_decide(
        args.request_id,
        args.revision,
        decision,
        permissions,
        actor,
        args.command_id
      )
    end
  end

  def cancel(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.communities_admins_cancel(args.request_id, args.revision, actor, args.command_id)
  end

  def update_permissions(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    with {:ok, member_id} <- parse_integer_id(args.member_id),
         {:ok, permissions} <- permission_map(args.permissions) do
      CMS.communities_admins_update_permissions(
        args.community_ref,
        member_id,
        args.revision,
        permissions,
        actor,
        args.command_id
      )
    end
  end

  def remove(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    with {:ok, member_id} <- parse_integer_id(args.member_id) do
      CMS.communities_admins_remove(
        args.community_ref,
        member_id,
        args.revision,
        actor,
        args.command_id
      )
    end
  end

  def leave(_root, args, %{context: %{cur_user: %User{} = actor}}) do
    CMS.communities_admins_leave(args.community_ref, args.revision, actor, args.command_id)
  end

  def current(_root, %{community_ref: ref}, %{context: %{cur_user: %User{} = actor}}) do
    CMS.communities_admins_current(ref, actor)
  end

  def management_allowed(_root, %{community_ref: ref}, %{context: %{cur_user: %User{} = actor}}) do
    CMS.communities_admins_management_allowed(ref, actor)
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
