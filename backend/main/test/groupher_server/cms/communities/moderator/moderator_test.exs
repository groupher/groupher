defmodule GroupherServer.Test.CMS.Communities.Moderator do
  @moduledoc false
  use GroupherServer.TestTools

  alias CMS.Communities.Passport
  alias CMS.Model.CommunityModerator
  alias Helper.PermissionRegistry

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, ~m(user user2 community)a}
  end

  describe "[cms community moderators]" do
    test "should have infinite passport count of root", ~m(user user2 community)a do
      role = "root"
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, role, user2, cur_user)

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count == PermissionRegistry.root_passport_item_count()

      new_passport_rules = %{
        "global" => %{},
        "cms" => %{
          "#{community.slug}" => %{
            "post.edit" => true,
            "post.pin" => true,
            "post.delete" => true
          }
        }
      }

      {:ok, _} =
        CMS.Communities.update_moderator_passport(community, new_passport_rules, user2, cur_user)

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count == PermissionRegistry.root_passport_item_count()
    end

    test "should have passport count of community after add moderator",
         ~m(user user2 community)a do
      role = "moderator"
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, role, user2, cur_user)

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count == 0

      new_passport_rules = %{
        "global" => %{},
        "cms" => %{
          "#{community.slug}" => %{
            "post.edit" => true,
            "post.pin" => true,
            "post.delete" => true
          }
        }
      }

      {:ok, _} =
        CMS.Communities.update_moderator_passport(community, new_passport_rules, user2, cur_user)

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count == 3

      new_passport_rules = %{
        "global" => %{},
        "cms" => %{
          "#{community.slug}" => %{
            "post.edit" => true,
            "post.pin" => false,
            "post.delete" => true
          }
        }
      }

      {:ok, _} =
        CMS.Communities.update_moderator_passport(community, new_passport_rules, user2, cur_user)

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count == 2
    end

    test "can update passport of community moderator", ~m(user user2 community)a do
      role = "moderator"
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, role, user2, cur_user)

      new_passport_rules = %{
        "global" => %{},
        "cms" => %{
          "#{community.slug}" => %{
            "post.delete" => false,
            "post.edit" => true
          }
        }
      }

      {:ok, _} =
        CMS.Communities.update_moderator_passport(community, new_passport_rules, user2, cur_user)

      {:ok, passport} = Passport.get_passport(user2)

      assert get_in(passport, ["cms", "#{community.slug}", "post.edit"]) == true
    end

    test "can not update passport of other community moderator", ~m(user user2 community)a do
      role = "moderator"
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, role, user2, cur_user)

      {:ok, other_community} = db_insert(:community)

      new_passport_rules = %{
        "global" => %{},
        "cms" => %{
          "#{other_community.slug}" => %{
            "post.delete" => false
          }
        }
      }

      {:error, reason} =
        CMS.Communities.update_moderator_passport(community, new_passport_rules, user2, cur_user)

      assert error_code(reason) == ecode(:passport_community_not_match)
    end

    test "can not update multi community passport", ~m(user user2 community)a do
      role = "moderator"
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, role, user2, cur_user)

      {:ok, other_community} = db_insert(:community)

      new_passport_rules = %{
        "global" => %{},
        "cms" => %{
          "#{community.slug}" => %{
            "post.delete" => false
          },
          "#{other_community.slug}" => %{
            "post.delete" => false
          }
        }
      }

      {:error, reason} =
        CMS.Communities.update_moderator_passport(community, new_passport_rules, user2, cur_user)

      assert error_code(reason) == ecode(:one_community_only)
    end

    test "can add multi moderators to a community", ~m(user user2 community)a do
      role = "moderator"
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, role, user2, cur_user)

      {:ok, moderators} = CommunityModerator |> ORM.find_all(%{page: 1, size: 10})

      assert moderators.total_count == 2

      moderator_user = moderators.entries |> Enum.find(&(&1.user_id == user.id))
      moderator_user2 = moderators.entries |> Enum.find(&(&1.user_id == user2.id))

      assert not is_nil(moderator_user)
      assert not is_nil(moderator_user2)
    end

    test "can add moderator to a community, moderator has default passport",
         ~m(user user2 community)a do
      role = "moderator"
      cur_user = user

      {:ok, _} = CMS.Communities.add_moderator(community, role, user2, cur_user)

      {:ok, moderator} = CommunityModerator |> ORM.find_by(user_id: user2.id)
      {:ok, user_passport} = Passport.get_passport(user2)

      assert moderator.user_id == user2.id
      assert moderator.community_id == community.id
      assert Map.equal?(%{"global" => %{}, "cms" => %{}}, user_passport)
    end

    test "user can get paged-moderators of a community", ~m(user community)a do
      {:ok, users} = db_insert_multi(:user, 25)
      role = "moderator"
      cur_user = user

      Enum.each(
        users,
        &CMS.Communities.add_moderator(community, role, %User{id: &1.id}, cur_user)
      )

      filter = %{page: 1, size: 10}
      {:ok, results} = CMS.Communities.members(:moderators, %Community{id: community.id}, filter)

      assert results |> is_valid_pagination?(:raw)
      assert results.total_count == 26
    end
  end
end
