defmodule GroupherServer.Test.CMS.Articles.BindingsTest do
  use GroupherServer.TestMate, async: true

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.Bindings
  alias CMS.Articles.Bindings.Tags
  alias CMS.Model.{ArticleBinding, ArticleBindingTag}

  setup do
    {community, post, _, user} = mock_article(:post)
    {:ok, destination} = mock_community(user)

    {:ok, ~m(community destination post user)a}
  end

  test "all/1 returns every binding without selecting one implicitly",
       ~m(community destination post user)a do
    command_id = Ecto.UUID.generate()

    assert {:ok, %ArticleBinding{}} =
             CMS.Articles.mirror(
               destination,
               post.article_id,
               [],
               user,
               community,
               command_id
             )

    assert {:ok, %ArticleBinding{}} =
             CMS.Articles.mirror(destination, post.article_id, [], user, community, command_id)

    assert {:ok, bindings} = Bindings.all(post)

    assert Enum.map(bindings, & &1.community_id) |> Enum.sort() ==
             Enum.sort([community.id, destination.id])
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
end
