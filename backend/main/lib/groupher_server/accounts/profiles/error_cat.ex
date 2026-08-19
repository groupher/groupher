defmodule GroupherServer.Accounts.Profiles.ErrorCat do
  @moduledoc false

  use GroupherServer.ErrorCat.Domain, namespace: {:account, :authentication}

  error(:account_login, code: 4301)
  error(:oauth_unlink, code: 4302)
  error(:not_exist, code: 4303)
  error(:current_session, code: 4304)
  error(:session_revoked, code: 4305)
  error(:session_expired, code: 4306)
  error(:session_not_found, code: 4307)
  error(:invalid_browser_access_claims, code: 4308)
  error(:invalid_legacy_access_claims, code: 4309)
end
