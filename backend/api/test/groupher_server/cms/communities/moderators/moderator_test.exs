defmodule GroupherServer.Test.CMS.Communities.Moderators do
  @moduledoc false
  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Communities.{ErrorCat, Passport}
  alias CMS.Communities.Moderators.Setup, as: ModeratorSetup
  alias CMS.Model.{CommunityAdmin, CommunityModerator}
  alias Helper.PermissionRegistry

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, ~m(user user2 community)a}
  end

  describe "[cms community moderators]" do
    test "community creation stores the owner as a canonical root member",
         ~m(user community)a do
      admin = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: user.id)

      assert admin.is_lord
      assert admin.permissions == %{}

      assert {:ok, true} =
               CMS.Passport.Authorization.check(user, "review.decide", %{community: community})
    end

    test "setup add_root requires a caller-owned transaction", ~m(user community)a do
      assert {:error, :community_moderator_transaction_required} =
               ModeratorSetup.add_root(community, user)
    end

    test "should have infinite passport count of root", ~m(user user2 community)a do
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, user2, cur_user, command_id())

      new_passport_rules = %{
        "global" => %{},
        "#{community.slug}" => %{"root" => true}
      }

      {:ok, _} =
        CMS.Communities.update_moderator_passport(
          community,
          new_passport_rules,
          user2,
          cur_user,
          command_id()
        )

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count == PermissionRegistry.root_passport_item_count()
    end

    test "tracks community permission count after moderator permission updates",
         ~m(user user2 community)a do
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, user2, cur_user, command_id())

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count > 0

      new_passport_rules = %{
        "global" => %{},
        "#{community.slug}" => %{
          "cms" => %{
            "post.restore" => true,
            "post.pin" => true,
            "post.trash" => true
          }
        }
      }

      {:ok, _} =
        CMS.Communities.update_moderator_passport(
          community,
          new_passport_rules,
          user2,
          cur_user,
          command_id()
        )

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count == 3

      new_passport_rules = %{
        "global" => %{},
        "#{community.slug}" => %{
          "cms" => %{
            "post.restore" => true,
            "post.pin" => false,
            "post.trash" => true
          }
        }
      }

      {:ok, _} =
        CMS.Communities.update_moderator_passport(
          community,
          new_passport_rules,
          user2,
          cur_user,
          command_id()
        )

      {:ok, moderator} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      assert moderator.passport_item_count == 2
    end

    test "new moderators keep the default Docs permissions", ~m(user user2 community)a do
      assert {:ok, _} = CMS.Communities.add_moderator(community, user2, user, command_id())

      moderator = Repo.get_by!(CommunityModerator, community_id: community.id, user_id: user2.id)

      for permission <- [
            "doc.queue.approve",
            "doc.queue.publish",
            "doc.queue.preview",
            "doc.queue.configure",
            "doc.history.read",
            "doc.import"
          ] do
        assert moderator.permissions[permission] == true
      end
    end

    test "can update passport of community moderator", ~m(user user2 community)a do
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, user2, cur_user, command_id())

      new_passport_rules = %{
        "global" => %{},
        "#{community.slug}" => %{
          "cms" => %{
            "post.trash" => false,
            "post.pin" => true
          }
        }
      }

      {:ok, _} =
        CMS.Communities.update_moderator_passport(
          community,
          new_passport_rules,
          user2,
          cur_user,
          command_id()
        )

      moderator = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: user2.id)

      assert moderator.permissions["post.pin"] == true
      refute Map.has_key?(moderator.permissions, "post.trash")
    end

    test "rejects unknown permissions before writing canonical moderator facts",
         ~m(user user2 community)a do
      assert {:ok, _} =
               CMS.Communities.add_moderator(community, user2, user, command_id())

      before = Repo.get_by!(CommunityModerator, community_id: community.id, user_id: user2.id)

      assert {:error, :unknown_action} =
               CMS.Communities.update_moderator_passport(
                 community,
                 %{
                   "global" => %{},
                   community.slug => %{"cms" => %{"unknown.action" => true}}
                 },
                 user2,
                 user,
                 command_id()
               )

      member = Repo.get_by!(CommunityModerator, community_id: community.id, user_id: user2.id)
      assert member.permissions == before.permissions
      assert member.passport_item_count == before.passport_item_count
    end

    test "can not update passport of other community moderator", ~m(user user2 community)a do
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, user2, cur_user, command_id())

      other_community_attrs = mock_attrs(:community)

      {:ok, other_community} =
        CMS.Communities.create(other_community_attrs, user, Ecto.UUID.generate())

      new_passport_rules = %{
        "global" => %{},
        "#{other_community.slug}" => %{
          "cms" => %{
            "post.trash" => false
          }
        }
      }

      {:error, reason} =
        CMS.Communities.update_moderator_passport(
          community,
          new_passport_rules,
          user2,
          cur_user,
          command_id()
        )

      assert error_code(reason) ==
               ErrorCat.code(ErrorCat.passport_community_not_match())
    end

    test "can not update multi community passport", ~m(user user2 community)a do
      cur_user = user
      {:ok, _} = CMS.Communities.add_moderator(community, user2, cur_user, command_id())

      other_community_attrs = mock_attrs(:community)

      {:ok, other_community} =
        CMS.Communities.create(other_community_attrs, user, Ecto.UUID.generate())

      new_passport_rules = %{
        "global" => %{},
        "#{community.slug}" => %{
          "cms" => %{
            "post.trash" => false
          }
        },
        "#{other_community.slug}" => %{
          "cms" => %{
            "post.trash" => false
          }
        }
      }

      {:error, reason} =
        CMS.Communities.update_moderator_passport(
          community,
          new_passport_rules,
          user2,
          cur_user,
          command_id()
        )

      assert error_code(reason) ==
               ErrorCat.code(ErrorCat.one_community_only())
    end

    test "can add multi moderators to a community", ~m(user user2 community)a do
      cur_user = user
      {:ok, user3} = db_insert(:user)

      {:ok, updated_community} =
        CMS.Communities.add_moderators(community, [user2, user3], cur_user, command_id())

      assert updated_community.moderators_count == 3

      {:ok, moderator_user} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user.id})

      {:ok, moderator_user2} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user2.id})

      {:ok, moderator_user3} =
        CommunityModerator |> ORM.find_by(%{community_id: community.id, user_id: user3.id})

      assert moderator_user
      assert moderator_user2
      assert moderator_user3
    end

    test "remove moderator deletes only the community-scoped passport rules",
         ~m(user user2 community)a do
      cur_user = user

      {:ok, other_community} =
        CMS.Communities.create(mock_attrs(:community), user, Ecto.UUID.generate())

      {:ok, _} = CMS.Communities.add_moderator(community, user2, cur_user, command_id())
      {:ok, _} = CMS.Communities.add_moderator(other_community, user2, cur_user, command_id())

      {:ok, _} = CMS.Communities.remove_moderator(community, user2, cur_user, command_id())
      {:ok, passport} = Passport.get_passport(user2)

      refute Map.has_key?(passport, community.slug)
      assert is_map(get_in(passport, [other_community.slug, "cms"]))
    end

    test "community root passport can manage moderators",
         ~m(user2 community)a do
      {:ok, user3} = db_insert(:user)

      Repo.insert!(
        CommunityAdmin.changeset(%CommunityAdmin{}, %{
          user_id: user2.id,
          community_id: community.id,
          is_lord: true,
          permissions: %{}
        })
      )

      {:ok, updated_community} =
        CMS.Communities.add_moderator(community, user3, user2, command_id())

      assert updated_community.slug == community.slug

      assert {:ok, _} =
               CommunityModerator |> ORM.find_by(user_id: user3.id, community_id: community.id)
    end

    test "adds a moderator with canonical default permissions",
         ~m(user user2 community)a do
      cur_user = user

      {:ok, _} = CMS.Communities.add_moderator(community, user2, cur_user, command_id())

      moderator = Repo.get_by!(CommunityAdmin, community_id: community.id, user_id: user2.id)
      default_rules = moderator.permissions

      assert moderator.user_id == user2.id
      assert moderator.community_id == community.id
      assert is_map(default_rules)
      assert default_rules != %{}

      assert map_size(default_rules) ==
               Enum.count(default_rules, fn {_action, enabled} -> enabled == true end)

      assert Enum.all?(Map.keys(default_rules), &String.contains?(&1, "."))
      assert Enum.all?(Map.keys(default_rules), &(not String.contains?(&1, "delete")))
      assert default_rules["post.pin"]
      assert default_rules["doc.queue.write"]
      assert default_rules["community_tag.set"]
      refute Map.has_key?(default_rules, "thread.create")
      refute Map.has_key?(default_rules, "moderator.set")
      refute Map.has_key?(default_rules, "community.update")
      refute Map.has_key?(default_rules, "post.edit")
    end

    test "user can get paged-moderators of a community", ~m(user community)a do
      {:ok, users} = db_insert_multi(:user, 25)
      cur_user = user

      Enum.each(
        users,
        &CMS.Communities.add_moderator(community, %User{id: &1.id}, cur_user, command_id())
      )

      filter = %{page: 1, size: 10}

      {:ok, results} =
        CMS.Communities.members(
          :moderators,
          %Community{id: community.id},
          %{},
          %GroupherServer.Pagi.Params.Offset{page: filter.page, size: filter.size}
        )

      assert %Helper.ORM.Pagi.Page.Offset{} = results
      assert results.total_count == 26
    end
  end

  defp command_id, do: Ecto.UUID.generate()
end
