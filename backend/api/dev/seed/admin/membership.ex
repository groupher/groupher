defmodule GroupherServer.Seed.Admin.Membership do
  @moduledoc """
  Runs revisioned Community Admin changes with a stable fixture operation key.

      run actor + operation key -> CMS Context -> stored command identity
  """
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.Community

  def run(action, run, %{"by" => by, "member" => name, "community" => slug, "key" => key} = input)
      when action in [:set_permissions, :remove] and is_binary(key) and byte_size(key) > 0 and
             byte_size(key) <= 40 do
    with {:ok, actor, binding} <- GroupherServer.Seed.Run.actor(run, by),
         {:ok, subject, _} <- GroupherServer.Seed.Run.actor(run, name),
         %Community{} = community <- Repo.get_by(Community, slug: slug),
         {:ok, permissions} <- permissions(action, input),
         identity <- %{
           "action" => Atom.to_string(action),
           "actor_id" => actor.id,
           "subject_id" => subject.id,
           "community_ref" => community.ref,
           "permissions" => permissions,
           "requested_revision" => input["revision"]
         },
         {:ok, entry} <- operation(run, key, identity, subject),
         {:ok, result} <- execute(action, entry, actor),
         {:ok, _} <- store(binding, key, entry) do
      {:ok, present(action, entry, result)}
    else
      nil -> {:error, :community_not_found}
      {:error, _} = error -> error
    end
  end

  def run(_, _, _), do: {:error, :invalid_local_test_membership}

  defp permissions(:remove, _), do: {:ok, nil}

  defp permissions(:set_permissions, %{"permissions" => permissions}) when is_map(permissions),
    do: CMS.passport_validate_permissions(:community, permissions)

  defp permissions(_, _), do: {:error, :invalid_permissions}

  defp operation(run, key, identity, subject) do
    matches =
      GroupherServer.Seed.Run.bindings(run)
      |> Enum.map(&(&1.raw["seed_admin_operations"] || %{})[key])
      |> Enum.reject(&is_nil/1)

    case matches do
      [] ->
        with {:ok, member} when is_map(member) <-
               CMS.get_current_community_admin_membership(identity["community_ref"], subject),
             {:ok, revision} <- revision(identity["requested_revision"], member.revision) do
          {:ok,
           Map.merge(identity, %{
             "member_id" => member.member_id,
             "revision" => revision,
             "command_id" => Ecto.UUID.generate()
           })}
        else
          {:ok, nil} -> {:error, :local_test_member_not_found}
          {:error, _} = error -> error
        end

      [entry] when is_map(entry) ->
        if Map.take(entry, Map.keys(identity)) == identity,
          do: {:ok, entry},
          else: {:error, :local_test_key_conflict}

      _ ->
        {:error, :local_test_key_conflict}
    end
  end

  defp revision(nil, current), do: {:ok, current}
  defp revision(value, _) when is_integer(value) and value > 0, do: {:ok, value}
  defp revision(_, _), do: {:error, :invalid_revision}

  defp present(:set_permissions, entry, result) do
    result
    |> Map.take([:member_id, :user_id, :is_lord, :permissions, :revision])
    |> Map.put(:command_status, "completed")
    |> Map.put(:subsequent_update, result.revision > entry["revision"] + 1)
  end

  defp present(:remove, _entry, result), do: result

  defp execute(:set_permissions, entry, actor),
    do:
      CMS.update_community_admin_permissions(
        entry["community_ref"],
        entry["member_id"],
        entry["revision"],
        entry["permissions"],
        actor,
        entry["command_id"]
      )

  defp execute(:remove, entry, actor),
    do:
      CMS.remove_community_admin(
        entry["community_ref"],
        entry["member_id"],
        entry["revision"],
        actor,
        entry["command_id"]
      )

  defp store(binding, key, entry) do
    operations = Map.put(binding.raw["seed_admin_operations"] || %{}, key, entry)

    binding
    |> Ecto.Changeset.change(raw: Map.put(binding.raw, "seed_admin_operations", operations))
    |> Repo.update()
  end
end
