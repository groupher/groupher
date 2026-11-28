defmodule GroupherServer.Test.Accounts.OauthLinks do
  use GroupherServer.TestMate

  alias Accounts.Model.{BrowserSession, OauthFlow, OauthProvider}
  alias Accounts.Profiles.{BrowserSessions, OauthFlows, OauthLinks}

  test "both identities sign into one user and unlink preserves prior sessions" do
    github = %{provider: "github", provider_id: "journey-github", login: "journey_user"}
    linux = %{provider: "linuxdo", provider_id: "journey-linuxdo", login: "journey_user"}

    assert {:ok, %{status: "SIGNED_IN", session: initial}} =
             Accounts.Profiles.signin_oauth(github, %{}, "journey-github-login", nil)

    owner_binding =
      Repo.get_by!(OauthProvider, provider: "github", provider_id: github.provider_id)

    user = Repo.get!(User, owner_binding.user_id)

    attrs = %{
      ref: "journey-link",
      provider: "linuxdo",
      browser_session_ref: initial.browser_session_ref,
      code_verifier: "verifier",
      nonce: "nonce",
      return_to: "https://dash.groupher.localhost/"
    }

    count_sessions = fn ->
      Repo.aggregate(from(session in BrowserSession, where: session.user_id == ^user.id), :count)
    end

    assert count_sessions.() == 1
    assert {:ok, _} = OauthLinks.start(user, attrs)

    assert {:ok, _} =
             OauthLinks.claim(user, attrs.ref, initial.browser_session_ref, "linuxdo", "nonce")

    assert {:ok, %{status: "confirm"}} =
             OauthLinks.verified(user, attrs.ref, initial.browser_session_ref, linux)

    assert count_sessions.() == 1

    assert {:ok, _} =
             OauthLinks.confirm(
               user,
               attrs.ref,
               initial.browser_session_ref,
               "linuxdo",
               linux.provider_id
             )

    assert count_sessions.() == 1

    linux_binding =
      Repo.get_by!(OauthProvider, provider: "linuxdo", provider_id: linux.provider_id)

    assert linux_binding.user_id == user.id

    assert {:ok, %{status: "SIGNED_IN", session: from_github}} =
             Accounts.Profiles.signin_oauth(github, %{}, "journey-github-again", nil)

    assert {:ok, %{status: "SIGNED_IN", session: from_linux}} =
             Accounts.Profiles.signin_oauth(linux, %{}, "journey-linux-login", nil)

    assert Repo.get_by!(BrowserSession, ref: from_github.browser_session_ref).user_id == user.id
    assert Repo.get_by!(BrowserSession, ref: from_linux.browser_session_ref).user_id == user.id

    assert {:ok, _} =
             Accounts.Profiles.unlink_oauth_identity(user.login, linux_binding.public_ref)

    assert {:ok, _} = BrowserSessions.refresh(from_linux.browser_session_ref)

    assert {:ok, %{status: "REGISTRATION_REQUIRED"}} =
             Accounts.Profiles.signin_oauth(linux, %{}, "journey-unlinked-login", nil)

    refute Repo.get_by(OauthProvider, provider: "linuxdo", provider_id: linux.provider_id)

    unused_name = %{linux | login: "journey_new_user"}

    assert {:ok, %{status: "SIGNED_IN", session: new_account_session}} =
             Accounts.Profiles.signin_oauth(unused_name, %{}, "journey-new-account", nil)

    new_owner = Repo.get_by!(BrowserSession, ref: new_account_session.browser_session_ref).user_id
    assert new_owner != user.id

    assert Repo.get_by!(OauthProvider, provider: "linuxdo", provider_id: linux.provider_id).user_id ==
             new_owner

    assert {:ok, _} = BrowserSessions.refresh(from_linux.browser_session_ref)
  end

  test "a link requires the initiating session, one exchange and explicit confirmation" do
    {:ok, user} = ORM.create(User, mock_attrs(:user))
    {:ok, session} = BrowserSessions.create(user)
    {:ok, other_session} = BrowserSessions.create(user)

    attrs = %{
      ref: "link-flow",
      provider: "linuxdo",
      browser_session_ref: session.browser_session_ref,
      code_verifier: "verifier",
      nonce: "nonce",
      return_to: "https://dash.groupher.localhost/"
    }

    assert {:ok, flow} = OauthLinks.start(user, attrs)
    assert {:ok, replay} = OauthLinks.start(user, attrs)
    assert replay.id == flow.id
    assert replay.expires_at == flow.expires_at
    assert {:error, :invalid_oauth_flow} = OauthLinks.start(user, %{attrs | nonce: "different"})

    assert {:error, :invalid_oauth_flow} =
             OauthLinks.start(user, %{attrs | return_to: "https://community.groupher.localhost/"})

    assert {:error, :invalid_oauth_flow} =
             OauthLinks.claim(
               user,
               attrs.ref,
               other_session.browser_session_ref,
               "linuxdo",
               "nonce"
             )

    assert {:ok, %{code_verifier: "verifier"}} =
             OauthLinks.claim(user, attrs.ref, session.browser_session_ref, "linuxdo", "nonce")

    assert {:error, :invalid_oauth_flow} =
             OauthLinks.claim(user, attrs.ref, session.browser_session_ref, "linuxdo", "nonce")

    assert {:error, :invalid_oauth_flow} = OauthLinks.start(user, attrs)
    assert Repo.get_by!(OauthFlow, ref: attrs.ref).code_verifier == nil
    identity = %{provider: "linuxdo", provider_id: "linked-identity", login: "external"}

    assert {:ok, %{status: "confirm"}} =
             OauthLinks.verified(user, attrs.ref, session.browser_session_ref, identity)

    refute Repo.get_by(OauthProvider, provider: "linuxdo", provider_id: "linked-identity")

    assert {:error, :invalid_oauth_flow} =
             OauthLinks.confirm(user, attrs.ref, session.browser_session_ref, "linuxdo", "wrong")

    assert {:ok, _} =
             OauthLinks.confirm(
               user,
               attrs.ref,
               session.browser_session_ref,
               "linuxdo",
               "linked-identity"
             )

    assert Repo.get_by!(OauthProvider, provider: "linuxdo", provider_id: "linked-identity").user_id ==
             user.id

    assert {:error, :invalid_oauth_flow} =
             OauthLinks.confirm(
               user,
               attrs.ref,
               session.browser_session_ref,
               "linuxdo",
               "linked-identity"
             )
  end

  test "an identity owned by this user is idempotent, while another owner's identity is rejected" do
    {:ok, user} = ORM.create(User, mock_attrs(:user))
    {:ok, other} = ORM.create(User, mock_attrs(:user))
    {:ok, session} = BrowserSessions.create(user)

    {:ok, _} =
      ORM.create(OauthProvider, %{
        user_id: user.id,
        provider: "linuxdo",
        provider_id: "same-owner",
        public_ref: "same-owner-ref"
      })

    {:ok, _} =
      ORM.create(OauthProvider, %{
        user_id: other.id,
        provider: "linuxdo",
        provider_id: "other-owner",
        public_ref: "other-owner-ref"
      })

    attrs = %{
      ref: "same-owner-flow",
      provider: "linuxdo",
      browser_session_ref: session.browser_session_ref,
      code_verifier: "verifier",
      nonce: "nonce",
      return_to: "https://dash.groupher.localhost/"
    }

    assert {:ok, _} = OauthLinks.start(user, attrs)

    assert {:ok, _} =
             OauthLinks.claim(user, attrs.ref, session.browser_session_ref, "linuxdo", "nonce")

    assert {:ok, %{status: "already_linked"}} =
             OauthLinks.verified(user, attrs.ref, session.browser_session_ref, %{
               provider: "linuxdo",
               provider_id: "same-owner"
             })

    assert Repo.get_by!(OauthFlow, ref: attrs.ref).status == "consumed"

    next = %{attrs | ref: "other-owner-flow"}
    assert {:ok, _} = OauthLinks.start(user, next)

    assert {:ok, _} =
             OauthLinks.claim(user, next.ref, session.browser_session_ref, "linuxdo", "nonce")

    assert {:error, :identity_already_linked} =
             OauthLinks.verified(user, next.ref, session.browser_session_ref, %{
               provider: "linuxdo",
               provider_id: "other-owner"
             })

    assert Repo.get_by!(OauthProvider, provider: "linuxdo", provider_id: "other-owner").user_id ==
             other.id

    assert Repo.get_by!(OauthFlow, ref: next.ref).identity == nil
  end

  test "a new session on another device does not renew the initiating session" do
    {:ok, user} = ORM.create(User, mock_attrs(:user))
    {:ok, old_session} = BrowserSessions.create(user)
    old = Repo.get_by!(BrowserSession, ref: old_session.browser_session_ref)

    old
    |> Ecto.Changeset.change(inserted_at: DateTime.add(DateTime.utc_now(:second), -600, :second))
    |> Repo.update!()

    assert {:ok, _} = BrowserSessions.create(user)

    attrs = %{
      ref: "stale-link",
      provider: "linuxdo",
      browser_session_ref: old_session.browser_session_ref,
      code_verifier: "verifier",
      nonce: "nonce",
      return_to: "https://dash.groupher.localhost/"
    }

    assert {:error, :recent_authentication_required} = OauthLinks.start(user, attrs)
  end

  test "refresh does not extend the initiating session's recent-authentication window" do
    {:ok, user} = ORM.create(User, mock_attrs(:user))
    {:ok, session} = BrowserSessions.create(user)
    row = Repo.get_by!(BrowserSession, ref: session.browser_session_ref)

    row
    |> Ecto.Changeset.change(inserted_at: DateTime.add(DateTime.utc_now(:second), -540, :second))
    |> Repo.update!()

    assert {:ok, _} = BrowserSessions.refresh(session.browser_session_ref)

    attrs = %{
      ref: "refresh-nine-minutes",
      provider: "linuxdo",
      browser_session_ref: session.browser_session_ref,
      code_verifier: "verifier",
      nonce: "nonce",
      return_to: "https://dash.groupher.localhost/"
    }

    assert {:ok, _} = OauthLinks.start(user, attrs)

    row = Repo.get_by!(BrowserSession, ref: session.browser_session_ref)

    row
    |> Ecto.Changeset.change(inserted_at: DateTime.add(DateTime.utc_now(:second), -600, :second))
    |> Repo.update!()

    assert {:ok, _} = BrowserSessions.refresh(session.browser_session_ref)

    assert {:error, :recent_authentication_required} =
             OauthLinks.start(user, %{attrs | ref: "refresh-ten-minutes"})
  end

  test "confirmation respects provider admission changed after authorization" do
    previous = Application.get_env(:groupher_server, :oauth_provider_states)
    on_exit(fn -> Application.put_env(:groupher_server, :oauth_provider_states, previous) end)

    Application.put_env(:groupher_server, :oauth_provider_states, %{
      "github" => :open,
      "linuxdo" => :open
    })

    {:ok, user} = ORM.create(User, mock_attrs(:user))
    {:ok, session} = BrowserSessions.create(user)

    attrs = %{
      ref: "admission-change",
      provider: "linuxdo",
      browser_session_ref: session.browser_session_ref,
      code_verifier: "verifier",
      nonce: "nonce",
      return_to: "https://dash.groupher.localhost/"
    }

    assert {:ok, _} = OauthLinks.start(user, attrs)

    assert {:ok, _} =
             OauthLinks.claim(user, attrs.ref, session.browser_session_ref, "linuxdo", "nonce")

    assert {:ok, %{status: "confirm"}} =
             OauthLinks.verified(user, attrs.ref, session.browser_session_ref, %{
               provider: "linuxdo",
               provider_id: "admission-change-identity"
             })

    Application.put_env(:groupher_server, :oauth_provider_states, %{
      "github" => :open,
      "linuxdo" => :existing
    })

    assert {:error, :oauth_provider_closed} =
             OauthLinks.confirm(
               user,
               attrs.ref,
               session.browser_session_ref,
               "linuxdo",
               "admission-change-identity"
             )

    refute Repo.get_by(OauthProvider,
             provider: "linuxdo",
             provider_id: "admission-change-identity"
           )

    assert {:ok, %{done: true}} = OauthLinks.cancel(user, attrs.ref, session.browser_session_ref)
  end

  test "flow and browser-session secrets are absent from debug SQL logs" do
    {:ok, user} = ORM.create(User, mock_attrs(:user))
    previous_level = Logger.level()
    Logger.configure(level: :debug)
    on_exit(fn -> Logger.configure(level: previous_level) end)

    log =
      ExUnit.CaptureLog.capture_log([level: :debug], fn ->
        {:ok, browser} = BrowserSessions.create(user)
        send(self(), {:session_ref, browser.browser_session_ref})

        attrs = %{
          ref: "log-secret-flow-reference",
          provider: "linuxdo",
          browser_session_ref: browser.browser_session_ref,
          code_verifier: "log-secret-verifier",
          nonce: "log-secret-nonce",
          return_to: "https://dash.groupher.localhost/"
        }

        assert {:ok, _} = OauthLinks.start(user, attrs)
        assert {:ok, _} = OauthLinks.start(user, attrs)

        assert {:ok, _} =
                 OauthLinks.claim(
                   user,
                   attrs.ref,
                   browser.browser_session_ref,
                   "linuxdo",
                   attrs.nonce
                 )

        assert {:ok, _} =
                 OauthLinks.verified(user, attrs.ref, browser.browser_session_ref, %{
                   provider: "linuxdo",
                   provider_id: "log-identity"
                 })

        assert {:ok, _} = OauthLinks.cancel(user, attrs.ref, browser.browser_session_ref)

        provider = %{
          provider: "linuxdo",
          provider_id: "registration-log-identity",
          login: "log_user"
        }

        assert {:ok, _} =
                 OauthFlows.create_registration("log-secret-registration-ref", provider, nil)

        assert {:ok, _} =
                 OauthFlows.create_registration("log-secret-registration-ref", provider, nil)

        assert {:ok, _} = OauthFlows.registration_summary("log-secret-registration-ref")
        assert BrowserSessions.active_for_user?(user.id, browser.browser_session_ref)
        assert {:ok, _} = BrowserSessions.refresh(browser.browser_session_ref)
        assert {:ok, :revoked} = BrowserSessions.revoke_current(browser.browser_session_ref)
        Repo.query!("SELECT 123456 AS oauth_log_control")
      end)

    assert log =~ "oauth_log_control"
    refute log =~ "log-secret-flow-reference"
    refute log =~ "log-secret-registration-ref"
    refute log =~ "log-secret-verifier"
    refute log =~ "log-secret-nonce"
    assert_receive {:session_ref, session_ref}
    refute log =~ session_ref
  end

  test "cancelling a failed exchange makes the claimed flow unusable" do
    {:ok, user} = ORM.create(User, mock_attrs(:user))
    {:ok, session} = BrowserSessions.create(user)

    attrs = %{
      ref: "failed-link",
      provider: "linuxdo",
      browser_session_ref: session.browser_session_ref,
      code_verifier: "verifier",
      nonce: "nonce",
      return_to: "https://dash.groupher.localhost/"
    }

    assert {:ok, _} = OauthLinks.start(user, attrs)

    assert {:ok, _} =
             OauthLinks.claim(user, attrs.ref, session.browser_session_ref, "linuxdo", "nonce")

    assert {:ok, %{done: true}} = OauthLinks.cancel(user, attrs.ref, session.browser_session_ref)

    assert {:error, :invalid_oauth_flow} =
             OauthLinks.verified(user, attrs.ref, session.browser_session_ref, %{
               provider: "linuxdo",
               provider_id: "failed"
             })
  end

  test "cancelling a confirmation consumes the flow without binding" do
    {:ok, user} = ORM.create(User, mock_attrs(:user))
    {:ok, session} = BrowserSessions.create(user)

    attrs = %{
      ref: "cancel-link",
      provider: "linuxdo",
      browser_session_ref: session.browser_session_ref,
      code_verifier: "verifier",
      nonce: "nonce",
      return_to: "https://dash.groupher.localhost/"
    }

    assert {:ok, _} = OauthLinks.start(user, attrs)

    assert {:ok, _} =
             OauthLinks.claim(user, attrs.ref, session.browser_session_ref, "linuxdo", "nonce")

    identity = %{provider: "linuxdo", provider_id: "cancelled-identity", login: "external"}
    assert {:ok, _} = OauthLinks.verified(user, attrs.ref, session.browser_session_ref, identity)
    assert {:ok, %{done: true}} = OauthLinks.cancel(user, attrs.ref, session.browser_session_ref)

    assert {:error, :invalid_oauth_flow} =
             OauthLinks.confirm(
               user,
               attrs.ref,
               session.browser_session_ref,
               "linuxdo",
               "cancelled-identity"
             )

    refute Repo.get_by(OauthProvider, provider: "linuxdo", provider_id: "cancelled-identity")
  end
end
