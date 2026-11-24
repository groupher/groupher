defmodule GroupherServer.CMS.Communities.Admins.Commands.UpdatePermissions do
  @moduledoc """
  Replaces a non-lord Community Admin's grantable Passport permissions.

      Admin permissions command -> Community / User / Admin locks -> Passport row + Activity
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Model.{Community, CommunityAdmin}
  alias CMS.Communities.Admins.Requests.Locks

  defmodule Confirmation do
    @moduledoc """
    Confirmation payload for a Community Admin permission replacement.

        permission update -> Confirmation -> idempotent replay
    """
    use GroupherServer.CMS.Command.ConfirmationDefinition,
      operation: :community_admin_permissions_update,
      data_keys: ["member_id"],
      field_types: %{"member_id" => :integer}
  end

  @pipeline operation: :community_admin_permissions_update,
            confirmation: Confirmation,
            target: :community,
            params: [:member_id, :revision, :permissions]
  receipt_pipeline run(community, member_id, revision, permissions, actor, command_id) do
    gate(fn canonical ->
      CMS.Gate.check_in_transaction(actor, :admin_permissions_update, canonical)
    end)

    change(fn canonical, operation_ref ->
      with %CommunityAdmin{} = prior <-
             Repo.get_by(CommunityAdmin, id: member_id, community_id: canonical.id),
           {:ok, locked} <- Locks.lock(canonical.id, [actor.id, prior.user_id], []),
           %CommunityAdmin{} = member <- Enum.find(locked.admins, &(&1.id == member_id)),
           {:ok, :pass} <- authorized_locked?(locked.community, actor),
           {:ok, normalized} <- CMS.Passport.Catalog.validate_permissions(:community, permissions),
           {:ok, updated} <- update_member(member, normalized, revision),
           {:ok, _} <-
             CMS.Communities.Admins.Effects.activity(
               locked.community,
               :admin_permissions_changed,
               actor,
               operation_ref,
               0,
               %{
                 subject_user_id: member.user_id,
                 member_id: member.id,
                 before_permissions: member.permissions,
                 after_permissions: updated.permissions
               }
             ) do
        {:ok, updated}
      else
        nil -> {:error, :admin_not_found}
        {:error, _} = error -> error
      end
    end)

    confirm(fn member -> {:ok, %Confirmation{data: %{"member_id" => member.id}}} end)

    present(fn %Confirmation{data: %{"member_id" => id}} ->
      case Repo.get(CommunityAdmin, id) do
        %CommunityAdmin{} = member -> {:ok, member}
        nil -> {:error, CMS.ErrorCat.command_result_unavailable()}
      end
    end)
  end

  @doc "Replaces a non-lord Admin's permissions when the supplied revision is current."
  def execute(
        %Community{} = community,
        member_id,
        revision,
        permissions,
        %User{} = actor,
        command_id
      )
      when is_integer(member_id) and is_integer(revision) and is_map(permissions) do
    run(community, member_id, revision, permissions, actor, command_id)
  end

  def execute(_, _, _, _, _, _), do: {:error, :invalid_admin_permissions}

  defp authorized_locked?(community, actor) do
    with {:ok, scope} <- CMS.Passport.load_community_scope(actor, community),
         true <- scope.global.is_root or scope.community.is_lord do
      {:ok, :pass}
    else
      _ -> {:error, :permission_denied}
    end
  end

  defp update_member(%CommunityAdmin{is_lord: true}, _permissions, _revision) do
    {:error, :lord_permissions_immutable}
  end

  defp update_member(%CommunityAdmin{revision: current} = member, permissions, current) do
    member
    |> CommunityAdmin.changeset(%{permissions: permissions, revision: current + 1})
    |> Repo.update()
  end

  defp update_member(%CommunityAdmin{}, _permissions, _revision) do
    {:error, :permission_revision_conflict}
  end
end
