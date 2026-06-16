defmodule GroupherServer.Test.CMS.Articles.Changelog do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Model.{ArticleDocument, ChangelogDocument}
  @article_digest_length get_config(:article, :digest_length)

  setup do
    {community, _, changelog_attrs, user} = mock_article(:changelog)
    {:ok, user2} = db_insert(:user)

    {:ok, ~m(user user2 community changelog_attrs)a}
  end

  describe "[cms changelog curd]" do
    test "created changelog should have auto_increase inner_id",
         ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      assert changelog.inner_id == 2

      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      assert changelog.inner_id == 3

      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      assert changelog.inner_id == 4

      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      assert blog.inner_id == 1

      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      assert blog.inner_id == 2

      {:ok, post} = CMS.Articles.create(community, :post, changelog_attrs, user)
      assert post.inner_id == 1

      {:ok, community} = ORM.find(Community, community.id)

      assert community.meta.changelogs_inner_id_index == 4
      assert community.meta.blogs_inner_id_index == 2
      assert community.meta.posts_inner_id_index == 1
      assert community.meta.docs_inner_id_index == 0

      assert community.articles_count == 7
    end

    test "can create changelog with valid attrs", ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      changelog = Repo.preload(changelog, :document)

      body_map = Jason.decode!(changelog.document.json)

      assert changelog.meta.thread == :changelog

      assert changelog.title == changelog_attrs.title
      assert is_list(body_map)

      assert changelog.document.html |> String.contains?("<p")

      assert is_binary(changelog.digest)
      assert String.length(changelog.digest) <= @article_digest_length
    end

    test "created changelog should have original_community info",
         ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      assert changelog.community_slug == community.slug
      assert changelog.community_id == community.id
    end

    test "created changelog should have a active_at field, same with inserted_at",
         ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      assert changelog.active_at == changelog.inserted_at
    end

    test "should read changelog by original community and inner id",
         ~m(changelog_attrs community user)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      {:ok, changelog2} =
        CMS.Articles.read(changelog.community_slug, :changelog, changelog.inner_id)

      assert changelog.id == changelog2.id
    end

    test "should read changelog by original community and inner id with user",
         ~m(changelog_attrs community user)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      {:ok, changelog2} =
        CMS.Articles.read(changelog.community_slug, :changelog, changelog.inner_id, user)

      assert changelog.id == changelog2.id

      {:ok, created} = ORM.find(Changelog, changelog2.id)
      assert user.id in created.meta.viewed_user_ids
    end

    test "read changelog should update views and meta viewed_user_list",
         ~m(changelog_attrs community user user2)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      # same user duplicate case
      {:ok, _} =
        CMS.Articles.read(changelog.community_slug, :changelog, changelog.inner_id, user)

      {:ok, created} = ORM.find(Changelog, changelog.id)

      assert created.meta.viewed_user_ids |> length == 1
      assert user.id in created.meta.viewed_user_ids

      {:ok, _} =
        CMS.Articles.read(changelog.community_slug, :changelog, changelog.inner_id, user2)

      {:ok, created} = ORM.find(Changelog, changelog.id)

      assert created.meta.viewed_user_ids |> length == 2
      assert user.id in created.meta.viewed_user_ids
      assert user2.id in created.meta.viewed_user_ids
    end

    test "read changelog should contains viewer_has_xxx state",
         ~m(changelog_attrs community user user2)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      {:ok, changelog} =
        CMS.Articles.read(changelog.community_slug, :changelog, changelog.inner_id, user)

      assert not changelog.viewer_has_collected
      assert not changelog.viewer_has_upvoted
      assert not changelog.viewer_has_reported

      {:ok, changelog} =
        CMS.Articles.read(changelog.community_slug, :changelog, changelog.inner_id)

      assert not changelog.viewer_has_collected
      assert not changelog.viewer_has_upvoted
      assert not changelog.viewer_has_reported

      {:ok, changelog} =
        CMS.Articles.read(changelog.community_slug, :changelog, changelog.inner_id, user2)

      assert not changelog.viewer_has_collected
      assert not changelog.viewer_has_upvoted
      assert not changelog.viewer_has_reported

      {:ok, _} = CMS.Articles.upvote(changelog, user)
      {:ok, changelog} = ORM.find(Changelog, changelog.id)
      {:ok, _} = CMS.Articles.collect(changelog, user)
      {:ok, _} = CMS.AbuseReports.article(changelog, "reason", "attr_info", user)

      {:ok, changelog} =
        CMS.Articles.read(changelog.community_slug, :changelog, changelog.inner_id, user)

      assert changelog.viewer_has_collected
      assert changelog.viewer_has_upvoted
      assert changelog.viewer_has_reported
    end

    test "add user to cms authors, if the user is not exist in cms authors",
         ~m(user2 community changelog_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user2.id)

      {:ok, _} = CMS.Articles.create(community, :changelog, changelog_attrs, user2)
      {:ok, author} = ORM.find_by(Author, user_id: user2.id)
      assert author.user_id == user2.id
    end
  end

  describe "[cms changelog sink/undo_sink]" do
    test "if a changelog is too old, read changelog should update can_undo_sink flag.",
         ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      assert changelog.meta.can_undo_sink

      {:ok, changelog_last_year} =
        db_insert(:changelog, %{
          title: "last year",
          inserted_at: @last_year,
          inner_id: changelog.inner_id + 1,
          community_slug: changelog.community_slug
        })

      {:ok, changelog_last_year} =
        CMS.Articles.read(
          changelog_last_year.community_slug,
          :changelog,
          changelog_last_year.inner_id
        )

      assert not changelog_last_year.meta.can_undo_sink

      {:ok, changelog_last_year} =
        CMS.Articles.read(
          changelog_last_year.community_slug,
          :changelog,
          changelog_last_year.inner_id,
          user
        )

      assert not changelog_last_year.meta.can_undo_sink
    end

    test "can sink a changelog", ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      assert not changelog.meta.is_sunk

      {:ok, changelog} = CMS.Articles.sink(changelog)
      assert changelog.meta.is_sunk
      assert changelog.active_at == changelog.inserted_at
    end

    test "can undo sink changelog", ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      {:ok, changelog} = CMS.Articles.sink(changelog)
      assert changelog.meta.is_sunk
      assert changelog.meta.last_active_at == changelog.active_at

      {:ok, changelog} = CMS.Articles.undo_sink(changelog)
      assert not changelog.meta.is_sunk
      assert changelog.active_at == changelog.meta.last_active_at
    end

    test "can not undo sink to old changelog", ~m()a do
      {:ok, changelog_last_year} =
        db_insert(:changelog, %{title: "last year", inserted_at: @last_year})

      {:error, reason} = CMS.Articles.undo_sink(changelog_last_year)
      is_error?(reason, :undo_sink_old_article)
    end
  end

  describe "[cms changelog batch delete]" do
    test "can batch delete changelogs with inner_ids", ~m(user community changelog_attrs)a do
      {:ok, changelog1} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      {:ok, changelog2} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      {:ok, changelog3} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      CMS.Articles.batch_mark_delete(community.slug, :changelog, [
        changelog1.inner_id,
        changelog2.inner_id
      ])

      {:ok, changelog1} = ORM.find(Changelog, changelog1.id)
      {:ok, changelog2} = ORM.find(Changelog, changelog2.id)
      {:ok, changelog3} = ORM.find(Changelog, changelog3.id)

      assert changelog1.mark_delete == true
      assert changelog2.mark_delete == true
      assert changelog3.mark_delete == false
    end

    test "can undo batch delete changelogs with inner_ids", ~m(user community changelog_attrs)a do
      {:ok, changelog1} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      {:ok, changelog2} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      {:ok, changelog3} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      CMS.Articles.batch_mark_delete(community.slug, :changelog, [
        changelog1.inner_id,
        changelog2.inner_id
      ])

      CMS.Articles.batch_undo_mark_delete(community.slug, :changelog, [
        changelog1.inner_id,
        changelog2.inner_id
      ])

      {:ok, changelog1} = ORM.find(Changelog, changelog1.id)
      {:ok, changelog2} = ORM.find(Changelog, changelog2.id)
      {:ok, _changelog3} = ORM.find(Changelog, changelog3.id)

      assert changelog1.mark_delete == false
      assert changelog2.mark_delete == false
    end
  end

  describe "[cms changelog document]" do
    test "will create related document after create", ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      {:ok, changelog} =
        CMS.Articles.read(changelog.community_slug, :changelog, changelog.inner_id)

      assert not is_nil(changelog.document.html)

      {:ok, changelog} =
        CMS.Articles.read(changelog.community_slug, :changelog, changelog.inner_id, user)

      assert not is_nil(changelog.document.html)

      {:ok, article_doc} =
        ORM.find_by(ArticleDocument, %{article_id: changelog.id, thread: :changelog})

      {:ok, changelog_doc} = ORM.find_by(ChangelogDocument, %{changelog_id: changelog.id})

      assert changelog.document.json == changelog_doc.json
      assert article_doc.json == changelog_doc.json
    end

    test "delete changelog should also delete related document",
         ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      {:ok, _article_doc} =
        ORM.find_by(ArticleDocument, %{article_id: changelog.id, thread: :changelog})

      {:ok, _changelog_doc} = ORM.find_by(ChangelogDocument, %{changelog_id: changelog.id})

      {:ok, _} = CMS.Articles.delete(changelog)

      {:error, _} = ORM.find(Changelog, changelog.id)
      {:error, _} = ORM.find_by(ArticleDocument, %{article_id: changelog.id, thread: :changelog})
      {:error, _} = ORM.find_by(ChangelogDocument, %{changelog_id: changelog.id})
    end

    test "update changelog should also update related document",
         ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      body = mock_rich_text(~s(new content))
      {:ok, changelog} = CMS.Articles.update(changelog, %{body: body})

      {:ok, article_doc} =
        ORM.find_by(ArticleDocument, %{article_id: changelog.id, thread: :changelog})

      {:ok, changelog_doc} = ORM.find_by(ChangelogDocument, %{changelog_id: changelog.id})

      assert String.contains?(changelog_doc.json, "new content")
      assert String.contains?(article_doc.json, "new content")
    end
  end
end
