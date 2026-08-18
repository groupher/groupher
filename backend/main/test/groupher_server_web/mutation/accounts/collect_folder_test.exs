defmodule GroupherServer.Test.Mutation.Accounts.CollectFolder do
  @moduledoc false
  use GroupherServer.TestMate

  alias Accounts.Model.CollectFolder
  alias CMS.Model.ArticleCollect

  setup do
    {community, post, _, user} = mock_article(:post)
    {_, blog, _, _} = mock_article(:blog, community, user)

    user_conn = simu_conn(:user, user)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn guest_conn user community post blog)a}
  end

  describe "[Accounts CollectFolder CRUD]" do
    @query S.Collect.m(:create_collect_folder)
    test "login user can create collect folder", ~m(user_conn)a do
      variables = %{title: "test folder", desc: "cool folder"}
      created = user_conn |> gq_mutation(@query, variables)
      {:ok, found} = CollectFolder |> ORM.find(created |> Map.get("id"))

      assert created |> Map.get("id") == to_string(found.id)
      assert created["lastUpdated"] != nil
    end

    test "login user can create private collect folder", ~m(user_conn)a do
      variables = %{title: "test folder", desc: "cool folder", private: true}
      created = user_conn |> gq_mutation(@query, variables)
      {:ok, found} = CollectFolder |> ORM.find(created |> Map.get("id"))

      assert created |> Map.get("id") == to_string(found.id)
      assert created |> Map.get("private")
    end

    test "unauth user create category fails", ~m(guest_conn)a do
      variables = %{title: "test folder"}

      assert guest_conn
             |> mutation_error?(
               @query,
               variables,
               ErrorCat.code(GroupherServer.Accounts.Profiles.ErrorCat.account_login())
             )
    end

    @query S.Collect.m(:update_collect_folder)
    test "login user can update own collect folder", ~m(user_conn user)a do
      args = %{title: "folder_title", private: false}
      {:ok, folder} = Accounts.CollectFolders.create(args, user)

      variables = %{id: folder.id, title: "new title", desc: "new desc", private: true}
      updated = user_conn |> gq_mutation(@query, variables)

      assert updated["desc"] == "new desc"
      assert updated["private"] == true
      assert updated["title"] == "new title"
      assert updated["lastUpdated"] != nil
    end

    @query S.Collect.m(:delete_collect_folder)
    test "login user can delete own collect folder", ~m(user_conn user)a do
      args = %{title: "folder_title", private: false}
      {:ok, folder} = Accounts.CollectFolders.create(args, user)

      variables = %{id: folder.id}
      user_conn |> gq_mutation(@query, variables)
      assert {:error, _} = CollectFolder |> ORM.find(folder.id)
    end
  end

  describe "[Accounts CollectFolder add/remove]" do
    @query S.Collect.m(:add_to_collect)
    @meta %{
      "hasPost" => false,
      "hasBlog" => false,
      "postCount" => 0,
      "blogCount" => 0
    }
    test "user can add a post to collect folder", ~m(user user_conn community post)a do
      args = %{title: "folder_title", private: false}
      {:ok, folder} = Accounts.CollectFolders.create(args, user)

      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug, thread: "POST"},
        folderId: folder.id
      }

      folder = user_conn |> gq_mutation(@query, variables)

      assert folder["totalCount"] == 1
      assert folder["lastUpdated"] != nil

      assert folder["meta"] == @meta |> Map.merge(%{"hasPost" => true, "postCount" => 1})

      {:ok, article_collect} =
        ArticleCollect |> ORM.find_by(%{post_id: post.id, user_id: user.id})

      folder_in_article_collect = article_collect.collect_folders |> List.first()

      assert folder_in_article_collect.meta.has_post
      assert folder_in_article_collect.meta.post_count == 1
    end

    test "user can add a blog to collect folder", ~m(user user_conn community blog)a do
      args = %{title: "folder_title", private: false}
      {:ok, folder} = Accounts.CollectFolders.create(args, user)

      variables = %{
        article: %{inner_id: blog.inner_id, community: community.slug, thread: "BLOG"},
        folderId: folder.id
      }

      folder = user_conn |> gq_mutation(@query, variables)

      assert folder["totalCount"] == 1
      assert folder["lastUpdated"] != nil

      assert folder["meta"] == @meta |> Map.merge(%{"hasBlog" => true, "blogCount" => 1})

      {:ok, article_collect} =
        ArticleCollect |> ORM.find_by(%{blog_id: blog.id, user_id: user.id})

      folder_in_article_collect = article_collect.collect_folders |> List.first()

      assert folder_in_article_collect.meta.has_blog
      assert folder_in_article_collect.meta.blog_count == 1
    end

    @query S.Collect.m(:remove_from_collect)
    test "user can remove a post from collect folder", ~m(user user_conn community post)a do
      args = %{title: "folder_title", private: false}
      {:ok, folder} = Accounts.CollectFolders.create(args, user)
      {:ok, _folder} = Accounts.CollectFolders.add(post, folder.id, user)

      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug, thread: "POST"},
        folderId: folder.id
      }

      result = user_conn |> gq_mutation(@query, variables)

      assert result["meta"] == @meta
      assert result["totalCount"] == 0
    end

    test "user can remove a blog from collect folder", ~m(user user_conn community blog)a do
      args = %{title: "folder_title", private: false}
      {:ok, folder} = Accounts.CollectFolders.create(args, user)
      {:ok, _folder} = Accounts.CollectFolders.add(blog, folder.id, user)

      variables = %{
        article: %{inner_id: blog.inner_id, community: community.slug, thread: "BLOG"},
        folderId: folder.id
      }

      result = user_conn |> gq_mutation(@query, variables)

      assert result["meta"] == @meta
      assert result["totalCount"] == 0
    end
  end
end
