defmodule GroupherServer.Test.Accounts.OauthFlows do
  use GroupherServer.TestMate

  alias Accounts.Model.{BrowserSession, OauthFlow, OauthProvider}
  alias Accounts.Profiles.OauthFlows

  test "reusing a registration reference is idempotent only for the same live flow" do
    provider = %{provider: "linuxdo", provider_id: "idempotent-id", login: "suggested"}
    ref = "idempotent-registration"
    return_to = "https://dash.groupher.localhost/"
    assert {:ok, original} = OauthFlows.create_registration(ref, provider, return_to)
    assert {:ok, replay} = OauthFlows.create_registration(ref, provider, return_to)
    assert replay.id == original.id
    assert replay.expires_at == original.expires_at

    assert {:error, :invalid_oauth_flow} =
             OauthFlows.create_registration(ref, %{provider | provider_id: "other"}, return_to)

    assert {:error, :invalid_oauth_flow} =
             OauthFlows.create_registration(
               ref,
               provider,
               "https://community.groupher.localhost/"
             )

    assert {:ok, _} = OauthFlows.complete_registration(ref, "idempotent_user", %{})

    assert {:error, :invalid_oauth_flow} =
             OauthFlows.create_registration(ref, provider, return_to)
  end

  test "registration consumes a verified identity once and keeps the flow on name conflict" do
    {:ok, existing} = ORM.create(User, mock_attrs(:user))

    provider = %{
      provider: "linuxdo",
      provider_id: "flow-123",
      login: existing.login,
      nickname: "Flow"
    }

    ref = "flow_registration_test"

    assert {:ok, _} =
             OauthFlows.create_registration(ref, provider, "https://dash.groupher.localhost/")

    assert {:ok, %{provider: "linuxdo", suggested_login: login}} =
             OauthFlows.registration_summary(ref)

    assert login == existing.login

    assert {:error, :login_unavailable} =
             OauthFlows.complete_registration(ref, existing.login, %{})

    assert Repo.get_by!(OauthFlow, ref: ref).status == "pending"

    assert {:ok, session} = OauthFlows.complete_registration(ref, "oauth_flow_test", %{})
    assert is_binary(session.browser_session_ref)
    binding = Repo.get_by!(OauthProvider, provider: "linuxdo", provider_id: "flow-123")
    assert Repo.get!(User, binding.user_id).login == "oauth_flow_test"
    assert Repo.get_by!(OauthFlow, ref: ref).status == "consumed"
    assert {:error, :invalid_oauth_flow} = OauthFlows.registration_summary(ref)

    assert {:error, :invalid_oauth_flow} =
             OauthFlows.complete_registration(ref, "other_login", %{})
  end

  test "a lost registration response is recovered by signing in to the same identity" do
    provider = %{provider: "linuxdo", provider_id: "lost-response-identity", login: "taken_name"}
    ref = "lost-response-flow"
    assert {:ok, _} = OauthFlows.create_registration(ref, provider, nil)
    assert {:ok, first_session} = OauthFlows.complete_registration(ref, "recovered_user", %{})
    binding = Repo.get_by!(OauthProvider, provider: "linuxdo", provider_id: provider.provider_id)
    first = Repo.get_by!(BrowserSession, ref: first_session.browser_session_ref)
    assert first.user_id == binding.user_id

    # The first response is discarded; a new provider authorization resolves the committed binding.
    assert {:ok, %{status: "SIGNED_IN", session: second_session}} =
             Accounts.Profiles.signin_oauth(provider, %{}, "new-authorization-flow", nil)

    second = Repo.get_by!(BrowserSession, ref: second_session.browser_session_ref)
    assert second.user_id == binding.user_id
    assert {:error, :invalid_oauth_flow} = OauthFlows.complete_registration(ref, "duplicate", %{})
  end

  test "session creation failure after registration permits reauthorization to the committed user" do
    provider = %{
      provider: "linuxdo",
      provider_id: "session-failure-identity",
      login: "suggested_name"
    }

    ref = "session-failure-flow"
    assert {:ok, _} = OauthFlows.create_registration(ref, provider, nil)

    assert {:error, _} =
             OauthFlows.complete_registration(ref, "session_failure_user", %{
               browser_family: %{invalid: true}
             })

    binding = Repo.get_by!(OauthProvider, provider: "linuxdo", provider_id: provider.provider_id)
    assert Repo.get_by!(OauthFlow, ref: ref).status == "consumed"
    refute Repo.get_by(BrowserSession, user_id: binding.user_id)

    assert {:ok, %{status: "SIGNED_IN", session: session}} =
             Accounts.Profiles.signin_oauth(provider, %{}, "session-failure-retry", nil)

    assert Repo.get_by!(BrowserSession, ref: session.browser_session_ref).user_id ==
             binding.user_id

    assert {:error, :invalid_oauth_flow} = OauthFlows.complete_registration(ref, "duplicate", %{})
  end

  test "expired registration cannot create an account" do
    provider = %{provider: "linuxdo", provider_id: "expired-flow", login: "expired_login"}
    assert {:ok, flow} = OauthFlows.create_registration("expired_ref", provider, nil)

    flow
    |> Ecto.Changeset.change(
      expires_at: DateTime.add(DateTime.utc_now(), -1, :second) |> DateTime.truncate(:second)
    )
    |> Repo.update!()

    assert {:error, :invalid_oauth_flow} =
             OauthFlows.create_registration("expired_ref", provider, nil)

    assert {:error, :invalid_oauth_flow} =
             OauthFlows.complete_registration("expired_ref", "expired_login", %{})

    refute Repo.get_by(OauthProvider, provider: "linuxdo", provider_id: "expired-flow")
  end

  test "registration observes provider admission changes" do
    previous = Application.get_env(:groupher_server, :oauth_provider_states)
    on_exit(fn -> Application.put_env(:groupher_server, :oauth_provider_states, previous) end)
    provider = %{provider: "linuxdo", provider_id: "closed-flow", login: "closed_user"}
    assert {:ok, _} = OauthFlows.create_registration("closed_ref", provider, nil)

    Application.put_env(:groupher_server, :oauth_provider_states, %{
      "github" => :open,
      "linuxdo" => :existing
    })

    assert {:error, :oauth_provider_closed} =
             OauthFlows.complete_registration("closed_ref", "closed_user", %{})

    assert Repo.get_by!(OauthFlow, ref: "closed_ref").status == "pending"
  end

  test "unlink keeps a usable provider when another provider is closed" do
    previous = Application.get_env(:groupher_server, :oauth_provider_states)
    on_exit(fn -> Application.put_env(:groupher_server, :oauth_provider_states, previous) end)

    Application.put_env(:groupher_server, :oauth_provider_states, %{
      "github" => :open,
      "linuxdo" => :closed
    })

    {:ok, user} = ORM.create(User, mock_attrs(:user))

    {:ok, github} =
      ORM.create(OauthProvider, %{
        user_id: user.id,
        provider: "github",
        provider_id: "unlink-github",
        public_ref: "unlink-github"
      })

    {:ok, _linuxdo} =
      ORM.create(OauthProvider, %{
        user_id: user.id,
        provider: "linuxdo",
        provider_id: "unlink-linuxdo",
        public_ref: "unlink-linuxdo"
      })

    assert {:ok, %{entries: entries}} = Accounts.Profiles.Query.linked_oauth_accounts(user.login)
    assert Enum.find(entries, &(&1.public_ref == github.public_ref)).can_unlink == false

    assert {:error, _} =
             Accounts.Profiles.Oauth.Workflow.unlink_identity_in_transaction(
               user.login,
               github.public_ref
             )

    assert Repo.get(OauthProvider, github.id)
  end
end
