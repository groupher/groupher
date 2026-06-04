defmodule GroupherServer.Test.CMS.Communities.Moderator do
  @moduledoc false
  use GroupherServer.TestMate

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
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, user2, cur_user)

      new_passport_rules = %{
        "global" => %{},
        "#{community.slug}" => %{"root" => true}
      }

      {:ok, _} =
        CMS.Communities.update_moderator_passport(community, new_passport_rules, user2, cur_user)

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count == PermissionRegistry.root_passport_item_count()
    end

    test "should have passport count of community after add moderator",
         ~m(user user2 community)a do
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, user2, cur_user)

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count > 0

      new_passport_rules = %{
        "global" => %{},
        "#{community.slug}" => %{
          "cms" => %{
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
        "#{community.slug}" => %{
          "cms" => %{
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
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, user2, cur_user)

      new_passport_rules = %{
        "global" => %{},
        "#{community.slug}" => %{
          "cms" => %{
            "post.delete" => false,
            "post.edit" => true
          }
        }
      }

      {:ok, _} =
        CMS.Communities.update_moderator_passport(community, new_passport_rules, user2, cur_user)

      {:ok, passport} = Passport.get_passport(user2)

      assert get_in(passport, ["#{community.slug}", "cms", "post.edit"]) == true
    end

    test "can not update passport of other community moderator", ~m(user user2 community)a do
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, user2, cur_user)

      other_community_attrs = mock_attrs(:community)
      {:ok, other_community} = CMS.Communities.create(other_community_attrs, user)

      new_passport_rules = %{
        "global" => %{},
        "#{other_community.slug}" => %{
          "cms" => %{
            "post.delete" => false
          }
        }
      }

      {:error, reason} =
        CMS.Communities.update_moderator_passport(community, new_passport_rules, user2, cur_user)

      assert error_code(reason) == ecode(:passport_community_not_match)
    end

    test "can not update multi community passport", ~m(user user2 community)a do
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, user2, cur_user)

      other_community_attrs = mock_attrs(:community)
      {:ok, other_community} = CMS.Communities.create(other_community_attrs, user)

      new_passport_rules = %{
        "global" => %{},
        "#{community.slug}" => %{
          "cms" => %{
            "post.delete" => false
          }
        },
        "#{other_community.slug}" => %{
          "cms" => %{
            "post.delete" => false
          }
        }
      }

      {:error, reason} =
        CMS.Communities.update_moderator_passport(community, new_passport_rules, user2, cur_user)

      assert error_code(reason) == ecode(:one_community_only)
    end

    test "can add multi moderators to a community", ~m(user user2 community)a do
      cur_user = user
      {:ok, user3} = db_insert(:user)

      {:ok, updated_community} =
        CMS.Communities.add_moderators(community, [user2, user3], cur_user)

      {:ok, moderators} = CommunityModerator |> ORM.find_all(%{page: 1, size: 10})

      assert moderators.total_count == 3
      assert updated_community.moderators_count == 3

      moderator_user = moderators.entries |> Enum.find(&(&1.user_id == user.id))
      moderator_user2 = moderators.entries |> Enum.find(&(&1.user_id == user2.id))
      moderator_user3 = moderators.entries |> Enum.find(&(&1.user_id == user3.id))

      assert not is_nil(moderator_user)
      assert not is_nil(moderator_user2)
      assert not is_nil(moderator_user3)
    end

    test "remove moderator deletes only the community-scoped passport rules",
         ~m(user user2 community)a do
      cur_user = user

      {:ok, other_community} = CMS.Communities.create(mock_attrs(:community), user)
      {:ok, _} = CMS.Communities.add_moderator(community, user2, cur_user)
      {:ok, _} = CMS.Communities.add_moderator(other_community, user2, cur_user)

      {:ok, _} = CMS.Communities.remove_moderator(community.slug, user2, cur_user)
      {:ok, passport} = Passport.get_passport(user2)

      refute Map.has_key?(passport, community.slug)
      assert is_map(get_in(passport, [other_community.slug, "cms"]))
    end

    test "community root passport can manage moderators",
         ~m(user2 community)a do
      {:ok, user3} = db_insert(:user)

      {:ok, _} =
        Passport.stamp_passport(
          %{
            "global" => %{},
            community.slug => %{"root" => true}
          },
          user2
        )

      {:ok, updated_community} =
        CMS.Communities.add_moderator(community, user3, user2)

      assert updated_community.slug == community.slug

      assert {:ok, _} =
               CommunityModerator |> ORM.find_by(user_id: user3.id, community_id: community.id)
    end

    test "can add moderator to a community, moderator has default passport",
         ~m(user user2 community)a do
      cur_user = user

      {:ok, _} = CMS.Communities.add_moderator(community, user2, cur_user)

      {:ok, moderator} = CommunityModerator |> ORM.find_by(user_id: user2.id)
      {:ok, user_passport} = Passport.get_passport(user2)
      default_rules = get_in(user_passport, [community.slug, "cms"])

      assert moderator.user_id == user2.id
      assert moderator.community_id == community.id
      assert user_passport["global"] == %{}
      assert is_map(default_rules)
      assert default_rules != %{}
      assert moderator.passport_item_count == map_size(default_rules)
      assert Enum.all?(Map.keys(default_rules), &String.contains?(&1, "."))
      assert Enum.all?(Map.keys(default_rules), &(not String.contains?(&1, "delete")))
      refute Map.has_key?(default_rules, "thread.create")
      refute Map.has_key?(default_rules, "moderator.set")
      refute Map.has_key?(default_rules, "community.update")
    end

    test "user can get paged-moderators of a community", ~m(user community)a do
      {:ok, users} = db_insert_multi(:user, 25)
      cur_user = user

      Enum.each(
        users,
        &CMS.Communities.add_moderator(community, %User{id: &1.id}, cur_user)
      )

      filter = %{page: 1, size: 10}
      {:ok, results} = CMS.Communities.members(:moderators, %Community{id: community.id}, filter)

      assert results |> is_valid_pagination?(:raw)
      assert results.total_count == 26
    end
  end
end
