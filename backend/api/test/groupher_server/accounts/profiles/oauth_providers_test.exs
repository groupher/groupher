defmodule GroupherServer.Test.Accounts.OauthProviders do
  use ExUnit.Case, async: false

  alias GroupherServer.Accounts
  alias Accounts.Profiles.OauthProviders

  test "lists configured public providers and keeps e2e internal and admitted" do
    previous = Application.get_env(:groupher_server, :oauth_provider_states)
    on_exit(fn -> Application.put_env(:groupher_server, :oauth_provider_states, previous) end)

    Application.put_env(:groupher_server, :oauth_provider_states, %{
      "github" => :open,
      "linuxdo" => :closed,
      "another" => :existing,
      "e2e" => :open
    })

    assert OauthProviders.public_list() == [
             %{provider: "another", state: "existing"},
             %{provider: "github", state: "open"}
           ]

    assert OauthProviders.allow_sign_in?("e2e")
    assert OauthProviders.allow_new_identity?("e2e")
    refute OauthProviders.allow_sign_in?("unknown")
  end
end
