defmodule GroupherServer.Seed.Community.RequestDestroy do
  @moduledoc """
  Requests reversible destruction of a Community owned by the current seed run.

      run owner + slug -> CMS Context -> retained lifecycle result
  """
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, CommunityLifecycle}

  def run(run, %{"by" => name, "slug" => slug}) when is_binary(slug) do
    with {:ok, actor, binding} <- GroupherServer.Seed.Run.actor(run, name),
         %Community{} = community <- Repo.get_by(Community, slug: slug),
         true <-
           community.user_id == actor.id and community.id in (binding.raw["communities"] || []),
         {:ok, entry} <- entry(binding, community),
         {:ok, _} <-
           CMS.request_community_destruction(community, actor, command_id: entry["command_id"]),
         {:ok, _} <- store(binding, slug, entry),
         %CommunityLifecycle{state: state} <-
           Repo.get_by(CommunityLifecycle, community_id: community.id) do
      {:ok, %{communityRef: community.ref, slug: slug, lifecycle: state}}
    else
      nil -> {:error, :community_not_found}
      false -> {:error, :local_test_community_not_owned}
      {:error, _} = error -> error
    end
  end

  def run(_, _), do: {:error, :invalid_local_test_community}

  defp entry(binding, community) do
    case (binding.raw["community_destroy_operations"] || %{})[community.slug] do
      nil ->
        case Repo.get_by(CommunityLifecycle, community_id: community.id) do
          %CommunityLifecycle{state: :active} ->
            {:ok, %{"community_id" => community.id, "command_id" => Ecto.UUID.generate()}}

          _ ->
            {:error, :local_test_community_lifecycle_changed}
        end

      %{"community_id" => id, "command_id" => command_id} = entry
      when id == community.id and is_binary(command_id) ->
        {:ok, entry}

      _ ->
        {:error, :local_test_key_conflict}
    end
  end

  defp store(binding, slug, entry) do
    operations = Map.put(binding.raw["community_destroy_operations"] || %{}, slug, entry)

    binding
    |> Ecto.Changeset.change(
      raw: Map.put(binding.raw, "community_destroy_operations", operations)
    )
    |> Repo.update()
  end
end
