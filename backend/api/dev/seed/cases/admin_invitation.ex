defmodule GroupherServer.Seed.Cases.AdminInvitation do
  @moduledoc """
  Prepares a pending invitation or an accepted community administrator.

      owner + invitee -> community -> invitation -> optional acceptance
  """
  alias GroupherServer.Seed.{Actor, Admin, Community}

  @doc "Prepares a case in the caller's run-locked transaction."
  def run(run, %{"community" => slug}, state)
      when is_binary(slug) and state in [:pending, :accepted] do
    with {:ok, owner} <- Actor.Create.run(run, %{"alias" => "owner"}),
         {:ok, invitee} <- Actor.Create.run(run, %{"alias" => "invitee"}),
         {:ok, community} <- Community.Create.run(run, %{"owner" => "owner", "slug" => slug}),
         {:ok, invitation} <-
           Admin.Invite.run(run, %{
             "by" => "owner",
             "to" => "invitee",
             "community" => slug,
             "key" => "case-invitation",
             "permissions" => %{"dashboard.theme.update" => true}
           }),
         {:ok, result} <- finish(run, invitation, state) do
      {:ok, %{owner: owner, invitee: invitee, community: community, invitation: result}}
    end
  end

  def run(_, _, _), do: {:error, :invalid_local_test_command}

  defp finish(_run, %{status: "pending"} = invitation, :pending), do: {:ok, invitation}
  defp finish(_run, _invitation, :pending), do: {:error, :local_test_case_state_conflict}

  defp finish(run, _invitation, :accepted) do
    Admin.Accept.run(run, %{"alias" => "invitee", "invite" => "case-invitation"})
  end
end
