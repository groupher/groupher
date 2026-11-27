defmodule GroupherServer.Seed.Run do
  @moduledoc """
  Resolves the synthetic identities owned by a local seed run.

      run + alias -> fixture binding -> authenticated actor identity
  """
  import Ecto.Query
  alias GroupherServer.{Accounts, Repo}
  alias Accounts.Model.OauthProvider

  @provider "local-test-actor-v1"
  @name ~r/\A[a-z][a-z0-9-]{0,39}\z/

  @doc "Returns the local fixture identity provider."
  def provider, do: @provider

  @doc "Checks the restricted local run or actor alias format."
  def valid_name?(name), do: is_binary(name) and Regex.match?(@name, name)

  @doc "Resolves one active run-owned actor and its fixture binding."
  def actor(run, name) do
    with true <- valid_name?(name),
         %OauthProvider{
           raw: %{"tool" => @provider, "status" => "active", "run" => ^run, "alias" => ^name}
         } = binding <-
           Repo.get_by(OauthProvider, provider: @provider, provider_id: "#{run}/#{name}"),
         {:ok, user} <- Accounts.front_desk_fresh_user(binding.user_id) do
      {:ok, user, binding}
    else
      _ -> {:error, :local_test_actor_unavailable}
    end
  end

  @doc "Lists the local fixture bindings owned by a run."
  def bindings(run) do
    Repo.all(from(o in OauthProvider, where: o.provider == @provider and o.raw["run"] == ^run))
  end

  @doc "Returns the non-secret identity summary of a fixture binding."
  def present(user, binding) do
    %{alias: binding.raw["alias"], login: user.login, status: binding.raw["status"]}
  end
end
