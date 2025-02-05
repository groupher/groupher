defmodule GroupherServer.Test.CMS do
  use GroupherServer.TestTools

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS
  alias CMS.Model.{Category, Community, CommunityModerator}

  alias Helper.{Certification, ORM}

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)
    # {:ok, community} = db_insert(:community)

    community_attrs = mock_attrs(:community) |> Map.merge(%{user_id: user.id})
    {:ok, community} = CMS.create_community(community_attrs)

    {:ok, category} = db_insert(:category)

    {:ok, ~m(user user2 community category)a}
  end

  describe "[cms category]" do
    test "create category with valid attrs", ~m(user)a do
      valid_attrs = mock_attrs(:category, %{user_id: user.id})
      ~m(title slug)a = valid_attrs

      {:ok, category} = CMS.create_category(~m(title slug)a, user)

      assert category.title == valid_attrs.title
    end

    test "create category with same title fails", ~m(user)a do
      valid_attrs = mock_attrs(:category, %{user_id: user.id})
      ~m(title slug)a = valid_attrs

      assert {:ok, _} = CMS.create_category(~m(title slug)a, user)
      assert {:error, _} = CMS.create_category(~m(title)a, user)
    end

    test "update category with valid attrs", ~m(user)a do
      valid_attrs = mock_attrs(:category, %{user_id: user.id})
      ~m(title slug)a = valid_attrs

      {:ok, category} = CMS.create_category(~m(title slug)a, user)

      assert category.title == valid_attrs.title
      {:ok, updated} = CMS.update_category(%Category{id: category.id, title: "new title"})

      assert updated.title == "new title"
    end

    test "update title to existing title fails", ~m(user)a do
      valid_attrs = mock_attrs(:category, %{user_id: user.id})
      ~m(title slug)a = valid_attrs

      {:ok, category} = CMS.create_category(~m(title slug)a, user)

      new_category_attrs = %{title: "category2 title", slug: "category2 title"}
      {:ok, category2} = CMS.create_category(new_category_attrs, user)

      {:error, _} = CMS.update_category(%Category{id: category.id, title: category2.title})
    end

    test "can set a category to a community", ~m(community category)a do
      {:ok, _} = CMS.set_category(community, category)

      {:ok, found_community} = ORM.find(Community, community.id, preload: :categories)
      {:ok, found_category} = ORM.find(Category, category.id, preload: :communities)

      assoc_categroies = found_community.categories |> Enum.map(& &1.id)
      assoc_communities = found_category.communities |> Enum.map(& &1.id)

      assert category.id in assoc_categroies
      assert community.id in assoc_communities
    end

    test "can unset a category to a community", ~m(community category)a do
      {:ok, _} = CMS.set_category(community, category)
      CMS.unset_category(community, category)

      {:ok, found_community} = ORM.find(Community, community.id, preload: :categories)
      {:ok, found_category} = ORM.find(Category, category.id, preload: :communities)

      assoc_categroies = found_community.categories |> Enum.map(& &1.id)
      assoc_communities = found_category.communities |> Enum.map(& &1.id)

      assert category.id not in assoc_categroies
      assert community.id not in assoc_communities
    end
  end

  describe "[cms community thread]" do
    test "can create thread to a community" do
      title = "OTHER"
      slug = "other"
      {:ok, thread} = CMS.create_thread(~m(title slug)a)
      assert thread.title == title
    end

    test "create thread with exsit title fails" do
      title = "POST"
      slug = title
      {:ok, _} = CMS.create_thread(~m(title slug)a)
      assert {:error, _error} = CMS.create_thread(~m(title slug)a)
    end

    test "can set a thread to community", ~m(community)a do
      title = "POST"
      slug = title
      {:ok, thread} = CMS.create_thread(~m(title slug)a)
      {:ok, ret_community} = CMS.set_thread(community, thread)

      assert ret_community.id == community.id
    end
  end

  describe "[cms community moderators]" do
    test "should have infinite passport count of root", ~m(user user2 community)a do
      role = "root"
      cur_user = user
      {:ok, _} = CMS.add_moderator(community.slug, role, user2, cur_user)

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count == Certification.root_passport_item_count()

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
        CMS.update_moderator_passport(community.slug, new_passport_rules, user2, cur_user)

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count == Certification.root_passport_item_count()
    end

    test "should have passport count of community after add moderator",
         ~m(user user2 community)a do
      role = "moderator"
      cur_user = user
      {:ok, _} = CMS.add_moderator(community.slug, role, user2, cur_user)

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
        CMS.update_moderator_passport(community.slug, new_passport_rules, user2, cur_user)

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
        CMS.update_moderator_passport(community.slug, new_passport_rules, user2, cur_user)

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count == default_passport_item_count + 2
    end

    test "can update passport of community moderator", ~m(user user2 community)a do
      role = "moderator"
      cur_user = user
      {:ok, _} = CMS.add_moderator(community.slug, role, user2, cur_user)

      new_passport_rules = %{
        "#{community.slug}" => %{
          "post.article.delete" => false,
          "post.tag.edit" => true
        }
      }

      {:ok, _} =
        CMS.update_moderator_passport(community.slug, new_passport_rules, user2, cur_user)

      {:ok, passport} = CMS.get_passport(user2)

      assert not Map.has_key?(passport, "post.article.delete")
      assert get_in(passport, ["#{community.slug}", "post.tag.edit"])
    end

    test "can not update passport of other community moderator", ~m(user user2 community)a do
      role = "moderator"
      cur_user = user
      {:ok, _} = CMS.add_moderator(community.slug, role, user2, cur_user)

      {:ok, other_community} = db_insert(:community)

      new_passport_rules = %{
        "#{other_community.slug}" => %{
          "post.article.delete" => false
        }
      }

      {:error, reason} =
        CMS.update_moderator_passport(community.slug, new_passport_rules, user2, cur_user)

      assert reason[:code] == ecode(:passport_community_not_match)
    end

    test "can not update multi community passport", ~m(user user2 community)a do
      role = "moderator"
      cur_user = user
      {:ok, _} = CMS.add_moderator(community.slug, role, user2, cur_user)

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
        CMS.update_moderator_passport(community.slug, new_passport_rules, user2, cur_user)

      assert reason[:code] == ecode(:one_community_only)
    end

    test "can add multi moderators to a community", ~m(user user2 community)a do
      role = "moderator"
      cur_user = user
      {:ok, _} = CMS.add_moderator(community.slug, role, user2, cur_user)

      {:ok, moderatorss} = CommunityModerator |> ORM.find_all(%{page: 1, size: 10})

      assert moderatorss.total_count == 2

      moderator_user = moderatorss.entries |> Enum.at(0)
      moderator_user2 = moderatorss.entries |> Enum.at(1)

      assert user.id == moderator_user.user_id
      assert user2.id == moderator_user2.user_id
    end

    test "can add moderator to a community, moderator has default passport",
         ~m(user user2 community)a do
      role = "moderator"
      cur_user = user

      {:ok, _} = CMS.add_moderator(community.slug, role, user2, cur_user)

      related_rules = Certification.passport_rules(cms: role)

      {:ok, moderator} = CommunityModerator |> ORM.find_by(user_id: user2.id)
      {:ok, user_passport} = CMS.get_passport(user2)

      assert moderator.user_id == user2.id
      assert moderator.community_id == community.id
      assert Map.equal?(related_rules, user_passport)
    end

    test "user can get paged-moderators of a community", ~m(user community)a do
      {:ok, users} = db_insert_multi(:user, 25)
      role = "moderator"
      cur_user = user

      Enum.each(users, &CMS.add_moderator(community.slug, role, %User{id: &1.id}, cur_user))

      filter = %{page: 1, size: 10}
      {:ok, results} = CMS.community_members(:moderators, %Community{id: community.id}, filter)

      assert results |> is_valid_pagination?(:raw)
      assert results.total_count == 26
    end
  end
end
