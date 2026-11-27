defmodule GroupherServer.ContextFacadeNamingTest do
  use ExUnit.Case, async: true

  alias GroupherServer.Accounts

  test "account facade actions use verb-first names" do
    exports = Accounts.__info__(:functions)

    for {current, previous} <- [
          {:page_users, :profiles_paged_users},
          {:update_profile, :profiles_update_profile},
          {:revoke_browser_session, :profiles_revoke_browser_session},
          {:unlink_oauth_identity, :profiles_unlink_oauth_identity},
          {:complete_oauth_registration, :profiles_complete_oauth_registration},
          {:follow_user, :fans_follow},
          {:unfollow_user, :fans_undo_follow},
          {:page_followers, :fans_paged_followers},
          {:page_followed_users, :fans_paged_followings},
          {:create_collect_folder, :collect_folders_create},
          {:update_collect_folder, :collect_folders_update},
          {:delete_collect_folder, :collect_folders_delete},
          {:page_upvoted_articles, :upvotes_paged_articles}
        ] do
      assert Enum.any?(exports, fn {name, _arity} -> name == current end)
      refute Enum.any?(exports, fn {name, _arity} -> name == previous end)
    end
  end
end
