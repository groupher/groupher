defmodule GroupherServer.Test.CMS.Communities.Moderator do
  @moduledoc false
  use GroupherServer.TestTools

  alias CMS.Model.CommunityModerator
  alias GroupherServer.CMS.Communities.Passport
  alias Helper.Certification

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

      assert moderator.passport_item_count == Certification.root_passport_item_count()

      new_community_rules =
        Certification.passport_rules(cms: "moderator")
        |> Map.merge(%{
          "post.tag.edit2" => true,
          "post.tag.edit3" => true,
          "post.tag.edit4" => true
        })

      new_passport_rules = %{
        "#{community.slug}" => new_community_rules
      }

      {:ok, _} =
        CMS.Communities.update_moderator_passport(community, new_passport_rules, user2, cur_user)

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count == Certification.root_passport_item_count()
    end

    test "should have passport count of community after add moderator",
         ~m(user user2 community)a do
      role = "moderator"
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, role, user2, cur_user)

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count == 0

      default_passport_item_count =
        Certification.passport_rules(cms: "moderator") |> Map.keys() |> length

      new_community_rules =
        Certification.passport_rules(cms: "moderator")
        |> Map.merge(%{
          "post.tag.edit2" => true,
          "post.tag.edit3" => true,
          "post.tag.edit4" => true
        })

      new_passport_rules = %{
        "#{community.slug}" => new_community_rules
      }

      {:ok, _} =
        CMS.Communities.update_moderator_passport(community, new_passport_rules, user2, cur_user)

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count == default_passport_item_count + 3

      new_community_rules =
        Certification.passport_rules(cms: "moderator")
        |> Map.merge(%{
          "post.tag.edit2" => true,
          "post.tag.edit3" => false,
          "post.tag.edit4" => true
        })

      new_passport_rules = %{
        "#{community.slug}" => new_community_rules
      }

      {:ok, _} =
        CMS.Communities.update_moderator_passport(community, new_passport_rules, user2, cur_user)

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count == default_passport_item_count + 2
    end

    test "can update passport of community moderator", ~m(user user2 community)a do
      role = "moderator"
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, role, user2, cur_user)

      new_passport_rules = %{
        "#{community.slug}" => %{
          "post.article.delete" => false,
          "post.tag.edit" => true
        }
      }

      {:ok, _} =
        CMS.Communities.update_moderator_passport(community, new_passport_rules, user2, cur_user)

      {:ok, passport} = Passport.get_passport(user2)

      assert not Map.has_key?(passport, "post.article.delete")
      assert get_in(passport, ["#{community.slug}", "post.tag.edit"])
    end

    test "can not update passport of other community moderator", ~m(user user2 community)a do
      role = "moderator"
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, role, user2, cur_user)

      {:ok, other_community} = db_insert(:community)

      new_passport_rules = %{
        "#{other_community.slug}" => %{
          "post.article.delete" => false
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
        "#{community.slug}" => %{
          "post.article.delete" => false
        },
        "#{other_community.slug}" => %{
          "post.article.delete" => false
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

      related_rules = Certification.passport_rules(cms: role)

      {:ok, moderator} = CommunityModerator |> ORM.find_by(user_id: user2.id)
      {:ok, user_passport} = Passport.get_passport(user2)

      assert moderator.user_id == user2.id
      assert moderator.community_id == community.id
      assert Map.equal?(related_rules, user_passport)
    end

    test "user can get paged-moderators of a community", ~m(user community)a do
      {:ok, users} = db_insert_multi(:user, 25)
      role = "moderator"
      cur_user = user

      Enum.each(users, &CMS.Communities.add_moderator(community, role, %User{id: &1.id}, cur_user))

      filter = %{page: 1, size: 10}
      {:ok, results} = CMS.Communities.members(:moderators, %Community{id: community.id}, filter)

      assert results |> is_valid_pagination?(:raw)
      assert results.total_count == 26
    end
  end
end
