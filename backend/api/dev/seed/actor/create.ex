defmodule GroupherServer.Seed.Actor.Create do
  @moduledoc """
  Creates or reuses one run-owned development actor.

      run and alias -> local OAuth registration -> fixture identity binding
  """
  alias GroupherServer.Repo
  alias GroupherServer.Accounts.Model.OauthProvider
  alias GroupherServer.Accounts.Profiles.Oauth

  @doc "Creates an actor inside the caller's run-locked transaction."
  def run(run, %{"alias" => name}) do
    cond do
      not GroupherServer.Seed.Run.valid_name?(name) ->
        {:error, :invalid_local_test_name}

      Enum.any?(GroupherServer.Seed.Run.bindings(run), &(&1.raw["status"] != "active")) ->
        {:error, :local_test_run_closed}

      true ->
        case GroupherServer.Seed.Run.actor(run, name) do
          {:ok, user, binding} -> {:ok, GroupherServer.Seed.Run.present(user, binding)}
          _ -> register(run, name)
        end
    end
  end

  def run(_, _), do: {:error, :invalid_local_test_command}

  defp register(run, name) do
    provider = GroupherServer.Seed.Run.provider()

    login =
      "lt-#{String.slice(run, 0, 12)}-#{name}-#{Base.encode16(:crypto.strong_rand_bytes(6), case: :lower)}"

    with {:ok, user} <-
           Oauth.register_in_transaction(%{
             provider: provider,
             provider_id: "#{run}/#{name}",
             login: login,
             nickname: "#{name} (#{run})"
           }),
         %OauthProvider{} = binding <-
           Repo.get_by(OauthProvider, provider: provider, user_id: user.id),
         {:ok, binding} <-
           binding
           |> Ecto.Changeset.change(
             raw: %{
               "tool" => provider,
               "run" => run,
               "alias" => name,
               "status" => "active",
               "communities" => []
             }
           )
           |> Repo.update() do
      {:ok, GroupherServer.Seed.Run.present(user, binding)}
    else
      {:error, _} = error -> error
      _ -> {:error, :local_test_registration_failed}
    end
  end
end
