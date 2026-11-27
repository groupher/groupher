defmodule GroupherServer.Seed.Community.Create do
  @moduledoc """
  Creates a run-owned community through the public CMS Context.

      owner -> Community command -> lifecycle and lord -> fixture binding
  """
  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.LocalTestActors.Communities
  alias CMS.Model.{Community, CommunityLifecycle}
  alias Helper.ORM.AdvisoryLock

  @doc "Creates or reuses one run-owned community in the caller transaction."
  def run(run, %{"owner" => name, "slug" => slug} = input) when is_binary(slug) do
    with {:ok, user, binding} <- GroupherServer.Seed.Run.actor(run, name),
         {:ok, :acquired} <- AdvisoryLock.acquire!("local-test-community-slug:#{slug}") do
      case Repo.get_by(Community, slug: slug) do
        nil ->
          with {:ok, community} <-
                 CMS.create_community(
                   %{
                     slug: slug,
                     title: input["title"] || "Local #{slug}",
                     desc: "Local test community for #{run}",
                     logo: "https://static.groupher.com/icons/cmd/alien_user3.svg"
                   },
                   user,
                   Ecto.UUID.generate()
                 ),
               {:ok, %{member_id: lord_id, is_lord: true}} <-
                 CMS.get_current_community_admin_membership(community.ref, user),
               {:ok, _} <-
                 binding
                 |> Ecto.Changeset.change(
                   raw:
                     binding.raw
                     |> Map.update!("communities", &[community.id | &1])
                     |> Map.update(
                       "community_creation_inputs",
                       %{slug => input["title"] || "Local #{slug}"},
                       fn inputs ->
                         Map.put(inputs, slug, input["title"] || "Local #{slug}")
                       end
                     )
                     |> Map.update(
                       "community_lords",
                       %{Integer.to_string(community.id) => lord_id},
                       fn lords ->
                         Map.put(lords, Integer.to_string(community.id), lord_id)
                       end
                     )
                 )
                 |> Repo.update() do
            present(community, user)
          end

        %Community{} = community ->
          if community.user_id == user.id and community.id in binding.raw["communities"] do
            inputs = binding.raw["community_creation_inputs"] || %{}

            if Map.has_key?(inputs, slug) and inputs[slug] != (input["title"] || "Local #{slug}") do
              {:error, :local_test_key_conflict}
            else
              present(community, user)
            end
          else
            case Repo.get_by(CommunityLifecycle, community_id: community.id) do
              %CommunityLifecycle{state: state}
              when state in [:archived, :pending_destroy, :destroy] ->
                {:error, {:slug_retained, state}}

              _ ->
                {:error, :local_test_community_collision}
            end
          end
      end
    end
  end

  def run(_, _), do: {:error, :invalid_local_test_community}

  @doc "Classifies a slug uniqueness race only after the failed transaction has rolled back."
  def resolve_slug_conflict({:error, reason} = result, %{"slug" => slug}) when is_binary(slug) do
    if slug_constraint_error?(reason) do
      case Repo.get_by(Community, slug: slug) do
        %Community{id: id} ->
          case Repo.get_by(CommunityLifecycle, community_id: id) do
            %CommunityLifecycle{state: state}
            when state in [:archived, :pending_destroy, :destroy] ->
              {:error, {:slug_retained, state}}

            _ ->
              {:error, :local_test_community_collision}
          end

        nil ->
          result
      end
    else
      result
    end
  end

  def resolve_slug_conflict(result, _), do: result

  defp slug_constraint_error?(%Ecto.Changeset{errors: errors}) do
    Enum.any?(errors, fn
      {:slug, {_message, metadata}} ->
        metadata[:constraint] == :unique and metadata[:constraint_name] == "communities_raw_index"

      _ ->
        false
    end)
  end

  defp slug_constraint_error?(reason) when is_tuple(reason) do
    reason |> Tuple.to_list() |> Enum.any?(&slug_constraint_error?/1)
  end

  defp slug_constraint_error?(_), do: false

  defp present(community, user) do
    with {:ok, _, facts} <- Communities.require_admin(user, community.slug) do
      {:ok, %{slug: community.slug, communityRef: community.ref, owner: user.login, admin: facts}}
    end
  end
end
