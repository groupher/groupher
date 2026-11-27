defmodule GroupherServer.Seed.Admin.Invite do
  @moduledoc """
  Creates one run-owned invitation through the Community Admin Context.

      run bindings + stable key -> Context invitation -> recorded request
  """
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.Community

  def run(run, %{
        "by" => by,
        "to" => to,
        "community" => slug,
        "key" => key,
        "permissions" => permissions
      })
      when is_binary(key) and byte_size(key) > 0 and byte_size(key) <= 40 and is_map(permissions) do
    with {:ok, actor, binding} <- GroupherServer.Seed.Run.actor(run, by),
         {:ok, subject, _} <- GroupherServer.Seed.Run.actor(run, to),
         %Community{} = community <- Repo.get_by(Community, slug: slug),
         {:ok, normalized} <- CMS.passport_validate_permissions(:community, permissions),
         {:ok, entry} <- entry(run, key, community, actor, subject, normalized),
         {:ok, request} <-
           CMS.create_community_admin_request(
             community.ref,
             subject.login,
             :invite,
             normalized,
             actor,
             entry["command_id"]
           ),
         saved <-
           entry
           |> Map.put_new("request_id", request.id)
           |> Map.put_new("request_revision", request.revision),
         {:ok, _} <- store(binding, key, saved) do
      {:ok, %{requestId: request.id, revision: request.revision, status: request.status}}
    else
      nil -> {:error, :community_not_found}
      {:error, _} = error -> error
    end
  end

  def run(_, _), do: {:error, :invalid_local_test_invitation}

  defp entry(run, key, community, actor, subject, permissions) do
    input = %{
      "community_ref" => community.ref,
      "actor_id" => actor.id,
      "subject_id" => subject.id,
      "permissions" => permissions
    }

    entries =
      GroupherServer.Seed.Run.bindings(run)
      |> Enum.map(&(&1.raw["seed_invitations"] || %{})[key])
      |> Enum.reject(&is_nil/1)

    case entries do
      [] ->
        {:ok, Map.put(input, "command_id", Ecto.UUID.generate())}

      [existing] when is_map(existing) ->
        if Map.take(existing, Map.keys(input)) == input do
          {:ok, existing}
        else
          {:error, :local_test_key_conflict}
        end

      _ ->
        {:error, :local_test_key_conflict}
    end
  end

  defp store(binding, key, entry) do
    invitations = Map.put(binding.raw["seed_invitations"] || %{}, key, entry)

    binding
    |> Ecto.Changeset.change(raw: Map.put(binding.raw, "seed_invitations", invitations))
    |> Repo.update()
  end
end
