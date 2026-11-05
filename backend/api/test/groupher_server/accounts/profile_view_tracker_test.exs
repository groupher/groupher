defmodule GroupherServer.Test.Accounts.ProfileViewTrackerTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo, RequestActor}
  alias Accounts.ProfileViewTracker
  alias Accounts.ProfileViewTracker.{Config, ErrorCat, Model.ProfileViewDedupeState}
  alias CMS.ViewTracker.AnonymousSession
  alias GroupherServerWeb.Schema
  alias Helper.ORM

  test "counts once per authenticated viewer window and returns committed views" do
    {:ok, profile} = db_insert(:user)
    {:ok, viewer} = db_insert(:user)
    {:ok, classification} = RequestActor.classify(account_session: viewer)

    assert {:ok, %{tracked: true, views: 1}} =
             ProfileViewTracker.track(profile, viewer, classification, read_purpose: :public_read)

    assert {:ok, %{tracked: true, views: 1}} =
             ProfileViewTracker.track(profile, viewer, classification, read_purpose: :public_read)

    assert {:ok, persisted} = ORM.find(Accounts.Model.User, profile.id)
    assert persisted.views == 1
    assert Repo.aggregate(ProfileViewDedupeState, :count) == 1
  end

  test "different stable viewers count independently" do
    {:ok, profile} = db_insert(:user)
    {:ok, viewer_one} = db_insert(:user)
    {:ok, viewer_two} = db_insert(:user)

    {:ok, actor_one} = RequestActor.classify(account_session: viewer_one)
    {:ok, actor_two} = RequestActor.classify(account_session: viewer_two)

    assert {:ok, %{views: 1}} =
             ProfileViewTracker.track(profile, viewer_one, actor_one, read_purpose: :public_read)

    assert {:ok, %{views: 2}} =
             ProfileViewTracker.track(profile, viewer_two, actor_two, read_purpose: :public_read)
  end

  test "Profile owner view is counted through the same dedupe window" do
    {:ok, profile} = db_insert(:user)
    {:ok, classification} = RequestActor.classify(account_session: profile)

    assert {:ok, %{tracked: true, views: 1}} =
             ProfileViewTracker.track(profile, profile, classification,
               read_purpose: :public_read
             )

    assert {:ok, %{tracked: true, views: 1}} =
             ProfileViewTracker.track(profile, profile, classification,
               read_purpose: :public_read
             )
  end

  test "a view counts again after the actor window elapses" do
    {:ok, profile} = db_insert(:user)
    {:ok, viewer} = db_insert(:user)
    {:ok, classification} = RequestActor.classify(account_session: viewer)

    assert {:ok, %{views: 1}} =
             ProfileViewTracker.track(profile, viewer, classification, read_purpose: :public_read)

    Repo.update_all(ProfileViewDedupeState,
      set: [last_counted_at: DateTime.add(DateTime.utc_now(), -601, :second)]
    )

    assert {:ok, %{tracked: true, views: 2}} =
             ProfileViewTracker.track(profile, viewer, classification, read_purpose: :public_read)
  end

  test "concurrent requests for one identity increment at most once" do
    {:ok, profile} = db_insert(:user)
    {:ok, viewer} = db_insert(:user)
    {:ok, classification} = RequestActor.classify(account_session: viewer)

    results =
      1..4
      |> Enum.map(fn _index ->
        Task.async(fn ->
          ProfileViewTracker.track(profile, viewer, classification, read_purpose: :public_read)
        end)
      end)
      |> Task.await_many(5_000)

    assert Enum.all?(results, &match?({:ok, %{tracked: true, views: 1}}, &1))
    assert {:ok, persisted} = ORM.find(Accounts.Model.User, profile.id)
    assert persisted.views == 1
  end

  test "policy-excluded read does not write view state" do
    {:ok, profile} = db_insert(:user)
    {:ok, viewer} = db_insert(:user)
    {:ok, classification} = RequestActor.classify(account_session: viewer)

    assert {:ok, %{tracked: false, views: 0}} =
             ProfileViewTracker.track(profile, viewer, classification,
               read_purpose: :operations_inspection
             )

    assert Repo.aggregate(ProfileViewDedupeState, :count) == 0
  end

  test "verified agent counts while self-reported automation is excluded" do
    {:ok, profile} = db_insert(:user)
    credential = service_credential("profile-agent")
    {:ok, verified_agent} = RequestActor.classify(service_credential: credential)

    assert {:ok, %{tracked: true, views: 1}} =
             ProfileViewTracker.track(profile, nil, verified_agent,
               read_purpose: :public_read,
               service_credential: credential
             )

    {:ok, self_reported} = RequestActor.classify(user_agent: "ExampleBot/1.0")

    assert {:ok, %{tracked: false, views: 1}} =
             ProfileViewTracker.track(profile, nil, self_reported, read_purpose: :public_read)
  end

  test "service token rotation keeps one stable agent dedupe identity" do
    {:ok, profile} = db_insert(:user)
    first_credential = service_credential("profile-agent")
    rotated_credential = %{first_credential | token_id: "rotated-jti"}
    {:ok, classification} = RequestActor.classify(service_credential: first_credential)

    assert {:ok, %{views: 1}} =
             ProfileViewTracker.track(profile, nil, classification,
               read_purpose: :public_read,
               service_credential: first_credential
             )

    assert {:ok, %{views: 1}} =
             ProfileViewTracker.track(profile, nil, classification,
               read_purpose: :public_read,
               service_credential: rotated_credential
             )

    assert Repo.aggregate(ProfileViewDedupeState, :count) == 1
  end

  test "missing read purpose fails before writing" do
    {:ok, profile} = db_insert(:user)
    {:ok, viewer} = db_insert(:user)
    {:ok, classification} = RequestActor.classify(account_session: viewer)

    assert {:error, error} = ProfileViewTracker.track(profile, viewer, classification)
    assert error == ErrorCat.missing_read_purpose()
    assert Repo.aggregate(ProfileViewDedupeState, :count) == 0
  end

  test "invalid read purpose fails before writing" do
    {:ok, profile} = db_insert(:user)
    {:ok, viewer} = db_insert(:user)
    {:ok, classification} = RequestActor.classify(account_session: viewer)

    assert {:error, error} =
             ProfileViewTracker.track(profile, viewer, classification, read_purpose: :made_up)

    assert error == ErrorCat.invalid_read_purpose()
    assert Repo.aggregate(ProfileViewDedupeState, :count) == 0
  end

  test "a missing Profile returns target not found without creating state" do
    [[missing_id]] =
      Repo.query!("SELECT nextval(pg_get_serial_sequence('account.users','id'))", []).rows

    profile = %User{id: missing_id}
    {:ok, viewer} = db_insert(:user)
    {:ok, classification} = RequestActor.classify(account_session: viewer)

    assert {:error, error} =
             ProfileViewTracker.track(profile, viewer, classification, read_purpose: :public_read)

    assert error == ErrorCat.target_not_found()
    assert Repo.aggregate(ProfileViewDedupeState, :count) == 0
  end

  test "verified delegation counts with its trusted user and service identity" do
    {:ok, profile} = db_insert(:user)
    {:ok, delegated_user} = db_insert(:user)

    delegation = %{
      service_actor: service_credential("profile-delegation"),
      user_actor: delegated_user
    }

    {:ok, classification} = RequestActor.classify(delegation: delegation)

    assert {:ok, %{tracked: true, views: 1}} =
             ProfileViewTracker.track(profile, delegated_user, classification,
               delegation: delegation,
               read_purpose: :public_read
             )
  end

  test "GraphQL tracks an anonymous visible Profile explicitly" do
    {:ok, profile} = db_insert(:user)
    session = %AnonymousSession{id: "profile-browser-session"}
    {:ok, classification} = RequestActor.classify(anonymous_session: session)

    mutation = """
    mutation TrackProfile($login: String!) {
      trackProfileView(login: $login) { tracked views }
    }
    """

    assert {:ok, %{data: %{"trackProfileView" => %{"tracked" => true, "views" => 1}}}} =
             Absinthe.run(mutation, Schema,
               variables: %{"login" => profile.login},
               context: %{anonymous_session: session, request_actor: classification}
             )
  end

  test "GraphQL tracks a scoped service actor through the resolver boundary" do
    {:ok, profile} = db_insert(:user)
    credential = service_credential("profile-service")
    {:ok, classification} = RequestActor.classify(service_credential: credential)

    assert {:ok, %{data: %{"trackProfileView" => %{"tracked" => true, "views" => 1}}}} =
             Absinthe.run(track_profile_mutation(), Schema,
               variables: %{"login" => profile.login},
               context: %{service_actor: credential, request_actor: classification}
             )
  end

  test "GraphQL tracks a verified delegation through the resolver boundary" do
    {:ok, profile} = db_insert(:user)
    {:ok, delegated_user} = db_insert(:user)

    delegation = %{
      service_actor: service_credential("profile-delegated-service"),
      user_actor: delegated_user
    }

    {:ok, classification} = RequestActor.classify(delegation: delegation)

    assert {:ok, %{data: %{"trackProfileView" => %{"tracked" => true, "views" => 1}}}} =
             Absinthe.run(track_profile_mutation(), Schema,
               variables: %{"login" => profile.login},
               context: %{delegated_actor: delegation, request_actor: classification}
             )
  end

  test "GraphQL formats a Profile ViewTracker actor error without raising" do
    {:ok, profile} = db_insert(:user)
    {:ok, viewer} = db_insert(:user)
    {:ok, classification} = RequestActor.classify(account_session: viewer)

    mutation = """
    mutation TrackProfile($login: String!) {
      trackProfileView(login: $login) { tracked views }
    }
    """

    assert {:ok,
            %{
              data: nil,
              errors: [%{extensions: %{code: 6253}}]
            }} =
             Absinthe.run(mutation, Schema,
               variables: %{"login" => profile.login},
               context: %{request_actor: classification}
             )
  end

  test "cleanup deletes only expired dedupe state" do
    {:ok, profile} = db_insert(:user)
    {:ok, viewer} = db_insert(:user)
    {:ok, classification} = RequestActor.classify(account_session: viewer)

    assert {:ok, %{tracked: true}} =
             ProfileViewTracker.track(profile, viewer, classification, read_purpose: :public_read)

    expire_profile_view_dedupe_states()

    assert %{deleted_rows: 1, remaining_expired_rows: 0} =
             ProfileViewTracker.cleanup_expired()

    assert Repo.aggregate(from(state in ProfileViewDedupeState), :count) == 0
  end

  test "cleanup stops at its row budget and drains the remainder on the next run" do
    old_config = Application.get_env(:groupher_server, Config)

    Application.put_env(:groupher_server, Config,
      human_dedupe_window_seconds: 10,
      agent_dedupe_window_seconds: 10,
      cleanup_safety_margin_seconds: 10,
      cleanup_batch_size: 1,
      cleanup_row_budget: 2,
      cleanup_time_budget_ms: 5_000
    )

    on_exit(fn -> restore_config(old_config) end)

    {:ok, profile} = db_insert(:user)

    for _index <- 1..3 do
      {:ok, viewer} = db_insert(:user)
      {:ok, classification} = RequestActor.classify(account_session: viewer)

      assert {:ok, %{tracked: true}} =
               ProfileViewTracker.track(profile, viewer, classification,
                 read_purpose: :public_read
               )
    end

    expire_profile_view_dedupe_states()

    assert %{deleted_rows: 2, budget_exhausted: true, remaining_expired_rows: 1} =
             ProfileViewTracker.cleanup_expired()

    assert %{deleted_rows: 1, budget_exhausted: false, remaining_expired_rows: 0} =
             ProfileViewTracker.cleanup_expired()
  end

  defp restore_config(nil), do: Application.delete_env(:groupher_server, Config)
  defp restore_config(config), do: Application.put_env(:groupher_server, Config, config)

  defp expire_profile_view_dedupe_states do
    now = DateTime.utc_now()

    Repo.update_all(ProfileViewDedupeState,
      set: [
        last_counted_at: DateTime.add(now, -2, :second),
        expires_at: DateTime.add(now, -1, :second)
      ]
    )
  end

  defp track_profile_mutation do
    """
    mutation TrackProfile($login: String!) {
      trackProfileView(login: $login) { tracked views }
    }
    """
  end
end
