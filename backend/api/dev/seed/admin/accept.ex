defmodule GroupherServer.Seed.Admin.Accept do
  @moduledoc """
  Accepts a run-owned invitation with the registered invitee identity.

      invitation key + invitee -> Context decision -> stored command identity
  """
  alias GroupherServer.{CMS, Repo}

  def run(run, %{"alias" => name, "invite" => key}) when is_binary(key) do
    with {:ok, actor, _} <- GroupherServer.Seed.Run.actor(run, name),
         {:ok, binding, entry} <- invitation(run, key),
         true <- entry["subject_id"] == actor.id,
         command_id <- entry["accept_command_id"] || Ecto.UUID.generate(),
         {:ok, request} <-
           CMS.decide_community_admin_request(
             entry["request_id"],
             entry["request_revision"],
             :accept,
             nil,
             actor,
             command_id
           ),
         updated <- Map.put(entry, "accept_command_id", command_id),
         {:ok, _} <- store(binding, key, updated) do
      {:ok, %{requestId: request.id, revision: request.revision, status: request.status}}
    else
      false -> {:error, :local_test_invitation_actor_mismatch}
      {:error, _} = error -> error
    end
  end

  def run(_, _), do: {:error, :invalid_local_test_invitation}

  defp invitation(run, key) do
    matches =
      GroupherServer.Seed.Run.bindings(run)
      |> Enum.flat_map(fn binding ->
        case (binding.raw["seed_invitations"] || %{})[key] do
          entry when is_map(entry) -> [{binding, entry}]
          _ -> []
        end
      end)

    case matches do
      [{binding, entry}] -> {:ok, binding, entry}
      [] -> {:error, :local_test_invitation_not_found}
      _ -> {:error, :local_test_key_conflict}
    end
  end

  defp store(binding, key, entry) do
    invitations = Map.put(binding.raw["seed_invitations"] || %{}, key, entry)

    binding
    |> Ecto.Changeset.change(raw: Map.put(binding.raw, "seed_invitations", invitations))
    |> Repo.update()
  end
end
