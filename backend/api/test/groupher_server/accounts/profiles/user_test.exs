defmodule GroupherServer.Test.Accounts.Profiles.User do
  @moduledoc false

  use GroupherServer.TestMate

  alias Helper.{Datetime, ORM}

  describe "[profile read and projection]" do
    test "user returns an in-memory zero projection without writing the User row" do
      {:ok, user} = db_insert(:user)
      {:ok, user} = ORM.update_embed(user, :contributes, nil)
      today = Datetime.today()

      assert {:ok, projected} = Accounts.Profiles.user(user)
      assert projected.contributes.total_count == 0
      assert projected.contributes.records == []
      assert projected.contributes.end_date == today
      assert projected.contributes.start_date == Datetime.shift(today, months: -6)

      assert {:ok, persisted} = ORM.find(User, user.id)
      assert persisted.contributes == nil
      assert persisted.views == 0
    end

    test "refresh_contributions is the single persisted projection writer" do
      {:ok, user} = db_insert(:user)

      digest = %{
        start_date: ~D[2026-01-01],
        end_date: ~D[2026-01-02],
        total_count: 2,
        records: []
      }

      assert {:ok, updated} = Accounts.Profiles.refresh_contributions(user.id, digest)
      assert updated.contributes.total_count == 2

      assert {:ok, persisted} = ORM.find(User, user.id)
      assert persisted.contributes == updated.contributes
      assert persisted.contributes.total_count == 2
    end
  end

  describe "[update user]" do
    test "profile update cannot change the Groupher login" do
      {:ok, user} = db_insert(:user)

      assert {:error, :immutable_login} =
               Accounts.Profiles.update_profile(user, %{login: "another-login"})

      assert {:ok, persisted} = ORM.find(User, user.id)
      assert persisted.login == user.login
    end

    test "update user with valid attrs" do
      {:ok, user} = db_insert(:user)

      attrs = %{
        nickname: "new nickname",
        sex: "dude",
        bio: "new bio",
        shortbio: "new shortbio",
        email: "new@qq.com"
      }

      {:ok, updated} = Accounts.Profiles.update_profile(user, attrs)

      assert updated.bio == attrs.bio
      assert updated.nickname == attrs.nickname
      assert updated.shortbio == attrs.shortbio
      assert updated.sex == attrs.sex
    end

    test "update user social fields with valid attrs" do
      {:ok, user} = db_insert(:user)

      attrs = %{
        location: "new name",
        social: %{
          github: "github addr",
          blog: "my blog",
          company: "my company",
          twitter: "twitter addr"
        }
      }

      {:ok, updated} = Accounts.Profiles.update_profile(user, attrs)

      assert updated.location == "new name"

      assert updated.social.github == attrs.social.github
      assert updated.social.twitter == attrs.social.twitter

      assert updated.social.company == attrs.social.company
      assert updated.social.blog == attrs.social.blog
    end

    test "skip social update when social attrs is nil" do
      {:ok, user} = db_insert(:user)

      {:ok, updated} =
        Accounts.Profiles.update_profile(user, %{nickname: "new nickname", social: nil})

      assert updated.nickname == "new nickname"
    end
  end
end
