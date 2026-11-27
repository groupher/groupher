defmodule GroupherServer.Seed.Scenario.ThemePermissions do
  @moduledoc """
  Composes actors and real community admin requests for theme authorization.

      owner + editor + limited -> community -> invite and accept memberships
  """
  alias GroupherServer.Seed.{Actor, Admin}

  @doc "Prepares the scenario inside the caller's run-locked transaction."
  def run(run, %{"community" => slug}) when is_binary(slug) do
    with {:ok, owner} <- Actor.Create.run(run, %{"alias" => "owner"}),
         {:ok, editor} <- Actor.Create.run(run, %{"alias" => "editor"}),
         {:ok, limited} <- Actor.Create.run(run, %{"alias" => "limited"}),
         {:ok, community} <-
           GroupherServer.Seed.Community.Create.run(run, %{"owner" => "owner", "slug" => slug}),
         {:ok, editor_invite} <- invite(run, slug, "editor", %{"dashboard.theme.update" => true}),
         {:ok, limited_invite} <- invite(run, slug, "limited", %{}) do
      {:ok,
       %{
         owner: owner,
         editor: editor,
         limited: limited,
         community: community,
         editor_invite: editor_invite,
         limited_invite: limited_invite
       }}
    end
  end

  def run(_, _), do: {:error, :invalid_local_test_command}

  defp invite(run, slug, alias_name, permissions) do
    key = "scenario-#{alias_name}"

    with {:ok, _} <-
           Admin.Invite.run(run, %{
             "by" => "owner",
             "to" => alias_name,
             "community" => slug,
             "key" => key,
             "permissions" => permissions
           }),
         {:ok, accepted} <- Admin.Accept.run(run, %{"alias" => alias_name, "invite" => key}) do
      {:ok, accepted}
    end
  end
end
