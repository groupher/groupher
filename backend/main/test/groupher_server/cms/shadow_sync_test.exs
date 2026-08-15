defmodule GroupherServer.Test.CMS.ShadowSyncTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.{Model.Embeds, ShadowSync}
  alias Helper.Cache

  setup do
    Cache.clear(:snapshot)
    :ok
  end

  test "refreshes bounded reaction snapshots without changing their membership or order" do
    {:ok, first_user} = db_insert(:user, nickname: "first fresh nickname")
    {:ok, second_user} = db_insert(:user, nickname: "second fresh nickname")

    Cache.put(:snapshot, "snapshot:user:#{first_user.id}", %{
      id: first_user.id,
      user_id: first_user.id,
      login: first_user.login,
      nickname: "first cached nickname",
      avatar: "first.png"
    })

    snapshots = [
      %{
        "id" => second_user.id,
        "login" => second_user.login,
        "nickname" => "second stale nickname",
        "user_id" => second_user.id
      },
      %{
        "id" => first_user.id,
        "login" => first_user.login,
        "nickname" => "first stale nickname",
        "user_id" => first_user.id
      }
    ]

    article = %{
      emotions: %{latest_beer_users: snapshots},
      meta: %{latest_upvoted_users: snapshots, latest_collected_users: snapshots}
    }

    refreshed = ShadowSync.refresh_article(article)

    assert Enum.map(refreshed.meta.latest_upvoted_users, & &1.user_id) ==
             [second_user.id, first_user.id]

    assert Enum.map(refreshed.emotions.latest_beer_users, & &1.user_id) ==
             [second_user.id, first_user.id]

    assert [%Embeds.User{nickname: "first cached nickname"}] =
             Enum.take(refreshed.meta.latest_collected_users, -1)

    assert refreshed.emotions.latest_beer_users |> length() == length(snapshots)
  end
end
