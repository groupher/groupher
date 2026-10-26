defmodule GroupherServer.Test.CMS.Articles.BindingsTest do
  use GroupherServer.TestMate, async: true

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.{CollectFolderEntry, Embeds}
  alias CMS.Articles.{BindingPersist, Bindings}
  alias CMS.Articles.Bindings.Tags
  alias CMS.Model.{Article, ArticleBinding, ArticleBindingTag}

  setup do
    {community, post, _, user} = mock_article(:post)
    {:ok, destination} = mock_community(user)
    user = grant_binding_actions(user, [community, destination])

    {:ok, ~m(community destination post user)a}
  end

  defp grant_binding_actions(user, communities) do
    grants =
      Enum.into(communities, %{}, fn community ->
        {community.slug, %{"cms" => %{"post.pin" => true}}}
      end)

    global = %{
      "post.community.mirror" => true,
      "post.community.move" => true,
      "post.community.unmirror" => true
    }

    Map.put(user, :cur_passport, Map.merge(%{"global" => global}, grants))
  end

  test "all/1 returns every binding without selecting one implicitly",
       ~m(community destination post user)a do
    command_id = Ecto.UUID.generate()

    assert {:ok, mirrored} =
             CMS.Articles.mirror(
               destination,
               post.article_id,
               [],
               user,
               community,
               command_id
             )

    assert mirrored.id == post.article_id

    assert {:ok, replayed} =
             CMS.Articles.mirror(destination, post.article_id, [], user, community, command_id)

    assert replayed.id == mirrored.id

    assert {:ok, bindings} = Bindings.all(post)

    assert Enum.map(bindings, & &1.community_id) |> Enum.sort() ==
             Enum.sort([community.id, destination.id])
  end

  test "fetch_binding/2 and fetch_pin/2 return tagged catalog errors for missing rows",
       ~m(community post)a do
    assert {:ok, %ArticleBinding{article_id: article_id, community_id: community_id}} =
             Bindings.fetch_binding(post.article_id, community.id)

    assert article_id == post.article_id
    assert community_id == community.id

    assert {:error,
            %ErrorCat.Error{
              namespace: {:cms, :article},
              reason: :binding_not_found
            }} =
             Bindings.fetch_binding(Ecto.UUID.generate(), community.id)

    assert {:error, %ErrorCat.Error{namespace: {:cms, :article}, reason: :pin_not_found}} =
             Bindings.fetch_pin(post.article_id, community.id)
  end

  test "Tags.replace/2 and list/1 own binding-local assignments",
       ~m(community destination post user)a do
    {:ok, group} =
      CMS.Communities.create_tag_group(
        community,
        :post,
        %{title: "binding-tags"},
        user,
        Ecto.UUID.generate()
      )

    {:ok, tag} =
      CMS.Communities.create_tag(
        community,
        :post,
        Map.put(mock_attrs(:community_tag), :group_id, group.id),
        user,
        Ecto.UUID.generate()
      )

    {:ok, destination_group} =
      CMS.Communities.create_tag_group(
        destination,
        :post,
        %{title: "foreign-tags"},
        user,
        Ecto.UUID.generate()
      )

    {:ok, foreign_tag} =
      CMS.Communities.create_tag(
        destination,
        :post,
        Map.put(mock_attrs(:community_tag), :group_id, destination_group.id),
        user,
        Ecto.UUID.generate()
      )

    binding =
      Repo.get_by!(ArticleBinding,
        article_id: post.article_id,
        community_id: community.id
      )

    assert {:ok, ^binding} =
             Repo.transact(fn -> Tags.replace(binding, [to_string(tag.id)]) end)

    assert {:ok, [listed]} = Tags.list(binding)
    assert listed.id == tag.id

    assert {:error, :invalid_community_tags} =
             Repo.transact(fn -> Tags.replace(binding, [foreign_tag.id]) end)

    assert {:ok, [unchanged]} = Tags.list(binding)
    assert unchanged.id == tag.id
  end

  test "duplicate binding tags return a changeset error through the named primary key",
       ~m(community post user)a do
    {:ok, group} =
      CMS.Communities.create_tag_group(
        community,
        :post,
        %{title: "unique-tag"},
        user,
        Ecto.UUID.generate()
      )

    {:ok, tag} =
      CMS.Communities.create_tag(
        community,
        :post,
        Map.put(mock_attrs(:community_tag), :group_id, group.id),
        user,
        Ecto.UUID.generate()
      )

    binding =
      Repo.get_by!(ArticleBinding,
        article_id: post.article_id,
        community_id: community.id
      )

    attrs = %{article_binding_id: binding.id, tag_id: tag.id}

    assert {:ok, %ArticleBindingTag{}} =
             Repo.insert(ArticleBindingTag.changeset(%ArticleBindingTag{}, attrs))

    assert {:error, changeset} =
             Repo.insert(ArticleBindingTag.changeset(%ArticleBindingTag{}, attrs))

    assert {"has already been taken", _metadata} = changeset.errors[:article_binding_id]
  end

  test "Tags.replace/2 fails closed without an owner transaction", ~m(community post)a do
    binding =
      Repo.get_by!(ArticleBinding,
        article_id: post.article_id,
        community_id: community.id
      )

    assert {:error, :article_binding_transaction_required} = Tags.replace(binding, [])
  end

  test "a collected binding is rejected before unmirror deletes it",
       ~m(community destination post user)a do
    article = Repo.get!(Article, post.article_id)

    assert {:ok, _binding} =
             Repo.transact(fn -> BindingPersist.mirror(article, destination) end)

    assert {:ok, folder} =
             Accounts.CollectFolders.Persist.create(
               %{title: "binding-delete-guard", meta: Embeds.CollectFolderMeta.default_meta()},
               user
             )

    source_binding =
      Repo.get_by!(ArticleBinding,
        article_id: post.article_id,
        community_id: community.id
      )

    assert {:ok, %CollectFolderEntry{}} =
             %CollectFolderEntry{}
             |> CollectFolderEntry.changeset(%{
               folder_id: folder.id,
               article_id: post.article_id,
               article_binding_id: source_binding.id
             })
             |> Repo.insert()

    assert {:error, :article_binding_collected} =
             Repo.transact(fn -> BindingPersist.unmirror(article, community) end)

    assert Repo.get(ArticleBinding, source_binding.id)
  end
end
