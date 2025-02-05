defmodule GroupherServer.Test.CMS.Articles.Changelog do
  use GroupherServer.TestTools

  import Helper.Utils, only: [get_config: 2]

  alias Helper.ORM
  alias GroupherServer.{CMS, Repo}
  alias Helper.Converter.{EditorToHTML, HtmlSanitizer}

  alias EditorToHTML.{Class, Validator}
  alias CMS.Model.{Author, ArticleDocument, Community, Changelog, ChangelogDocument}

  @root_class Class.article()
  @last_year Timex.shift(Timex.beginning_of_year(Timex.now()), days: -3, seconds: -1)
  @article_digest_length get_config(:article, :digest_length)

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, user2} = db_insert(:user)

    {:ok, community} = db_insert(:community)
    {:ok, changelog} = db_insert(:changelog)

    changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

    {:ok, ~m(user user2 community changelog changelog_attrs)a}
  end

  describe "[cms changelog curd]" do
    test "created changelog should have auto_increase inner_id",
         ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      assert changelog.inner_id == 1

      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      assert changelog.inner_id == 2

      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      assert changelog.inner_id == 3

      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      assert blog.inner_id == 1

      {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
      assert blog.inner_id == 2

      {:ok, post} = CMS.create_article(community, :post, changelog_attrs, user)
      assert post.inner_id == 1

      {:ok, community} = ORM.find(Community, community.id)

      assert community.meta.changelogs_inner_id_index == 3
      assert community.meta.blogs_inner_id_index == 2
      assert community.meta.posts_inner_id_index == 1
      assert community.meta.docs_inner_id_index == 0

      assert community.articles_count == 6
    end

    test "can create changelog with valid attrs", ~m(user community changelog_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user.id)

      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      changelog = Repo.preload(changelog, :document)

      body_map = Jason.decode!(changelog.document.body)

      assert changelog.meta.thread == "CHANGELOG"

      assert changelog.title == changelog_attrs.title
      assert body_map |> Validator.is_valid()

      assert changelog.document.body_html
             |> String.contains?(~s(<div class="#{@root_class["viewer"]}">))

      assert changelog.document.body_html |> String.contains?(~s(<p id="block-))

      paragraph_text = body_map["blocks"] |> List.first() |> get_in(["data", "text"])

      assert changelog.digest ==
               paragraph_text
               |> HtmlSanitizer.strip_all_tags()
               |> String.slice(0, @article_digest_length)
    end

    test "created changelog should have original_community info",
         ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      assert changelog.original_community_slug == community.slug
      assert changelog.original_community_id == community.id
    end

    test "created changelog should have a acitve_at field, same with inserted_at",
         ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      assert changelog.active_at == changelog.inserted_at
    end

    test "should read changelog by original community and inner id",
         ~m(changelog_attrs community user)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      {:ok, changelog2} =
        CMS.read_article(changelog.original_community_slug, :changelog, changelog.inner_id)

      assert changelog.id == changelog2.id
    end

    test "should read changelog by original community and inner id with user",
         ~m(changelog_attrs community user)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      {:ok, changelog2} =
        CMS.read_article(changelog.original_community_slug, :changelog, changelog.inner_id, user)

      assert changelog.id == changelog2.id

      {:ok, created} = ORM.find(Changelog, changelog2.id)
      assert user.id in created.meta.viewed_user_ids
    end

    test "read changelog should update views and meta viewed_user_list",
         ~m(changelog_attrs community user user2)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      # same user duplicate case
      {:ok, _} =
        CMS.read_article(changelog.original_community_slug, :changelog, changelog.inner_id, user)

      {:ok, created} = ORM.find(Changelog, changelog.id)

      assert created.meta.viewed_user_ids |> length == 1
      assert user.id in created.meta.viewed_user_ids

      {:ok, _} =
        CMS.read_article(changelog.original_community_slug, :changelog, changelog.inner_id, user2)

      {:ok, created} = ORM.find(Changelog, changelog.id)

      assert created.meta.viewed_user_ids |> length == 2
      assert user.id in created.meta.viewed_user_ids
      assert user2.id in created.meta.viewed_user_ids
    end

    test "read changelog should contains viewer_has_xxx state",
         ~m(changelog_attrs community user user2)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      {:ok, changelog} =
        CMS.read_article(changelog.original_community_slug, :changelog, changelog.inner_id, user)

      assert not changelog.viewer_has_collected
      assert not changelog.viewer_has_upvoted
      assert not changelog.viewer_has_reported

      {:ok, changelog} =
        CMS.read_article(changelog.original_community_slug, :changelog, changelog.inner_id)

      assert not changelog.viewer_has_collected
      assert not changelog.viewer_has_upvoted
      assert not changelog.viewer_has_reported

      {:ok, changelog} =
        CMS.read_article(changelog.original_community_slug, :changelog, changelog.inner_id, user2)

      assert not changelog.viewer_has_collected
      assert not changelog.viewer_has_upvoted
      assert not changelog.viewer_has_reported

      {:ok, _} = CMS.upvote_article(:changelog, changelog.id, user)
      {:ok, _} = CMS.collect_article(:changelog, changelog.id, user)
      {:ok, _} = CMS.report_article(:changelog, changelog.id, "reason", "attr_info", user)

      {:ok, changelog} =
        CMS.read_article(changelog.original_community_slug, :changelog, changelog.inner_id, user)

      assert changelog.viewer_has_collected
      assert changelog.viewer_has_upvoted
      assert changelog.viewer_has_reported
    end

    test "add user to cms authors, if the user is not exsit in cms authors",
         ~m(user community changelog_attrs)a do
      assert {:error, _} = ORM.find_by(Author, user_id: user.id)

      {:ok, _} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, author} = ORM.find_by(Author, user_id: user.id)
      assert author.user_id == user.id
    end

    test "create changelog with an non-exsit community fails", ~m(user)a do
      invalid_attrs = mock_attrs(:changelog, %{community_id: non_exsit_id()})
      ivalid_community = %Community{id: non_exsit_id(), slug: non_exsit_slug()}

      assert {:error, _} = CMS.create_article(ivalid_community, :changelog, invalid_attrs, user)
    end
  end

  describe "[cms changelog sink/undo_sink]" do
    test "if a changelog is too old, read changelog should update can_undo_sink flag.",
         ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      assert changelog.meta.can_undo_sink

      {:ok, changelog_last_year} =
        db_insert(:changelog, %{
          title: "last year",
          inserted_at: @last_year,
          inner_id: changelog.inner_id + 1,
          original_community_slug: changelog.original_community_slug
        })

      {:ok, changelog_last_year} =
        CMS.read_article(
          changelog_last_year.original_community_slug,
          :changelog,
          changelog_last_year.inner_id
        )

      assert not changelog_last_year.meta.can_undo_sink

      {:ok, changelog_last_year} =
        CMS.read_article(
          changelog_last_year.original_community_slug,
          :changelog,
          changelog_last_year.inner_id,
          user
        )

      assert not changelog_last_year.meta.can_undo_sink
    end

    test "can sink a changelog", ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      assert not changelog.meta.is_sinked

      {:ok, changelog} = CMS.sink_article(:changelog, changelog.id)
      assert changelog.meta.is_sinked
      assert changelog.active_at == changelog.inserted_at
    end

    test "can undo sink changelog", ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, changelog} = CMS.sink_article(:changelog, changelog.id)
      assert changelog.meta.is_sinked
      assert changelog.meta.last_active_at == changelog.active_at

      {:ok, changelog} = CMS.undo_sink_article(:changelog, changelog.id)
      assert not changelog.meta.is_sinked
      assert changelog.active_at == changelog.meta.last_active_at
    end

    test "can not undo sink to old changelog", ~m()a do
      {:ok, changelog_last_year} =
        db_insert(:changelog, %{title: "last year", inserted_at: @last_year})

      {:error, reason} = CMS.undo_sink_article(:changelog, changelog_last_year.id)
      is_error?(reason, :undo_sink_old_article)
    end
  end

  describe "[cms changelog batch delete]" do
    test "can batch delete changelogs with inner_ids", ~m(user community changelog_attrs)a do
      {:ok, changelog1} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, changelog2} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, changelog3} = CMS.create_article(community, :changelog, changelog_attrs, user)

      CMS.batch_mark_delete_articles(community.slug, :changelog, [
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
      {:ok, changelog1} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, changelog2} = CMS.create_article(community, :changelog, changelog_attrs, user)
      {:ok, changelog3} = CMS.create_article(community, :changelog, changelog_attrs, user)

      CMS.batch_mark_delete_articles(community.slug, :changelog, [
        changelog1.inner_id,
        changelog2.inner_id
      ])

      CMS.batch_undo_mark_delete_articles(community.slug, :changelog, [
        changelog1.inner_id,
        changelog2.inner_id
      ])

      {:ok, changelog1} = ORM.find(Changelog, changelog1.id)
      {:ok, changelog2} = ORM.find(Changelog, changelog2.id)
      {:ok, changelog3} = ORM.find(Changelog, changelog3.id)

      assert changelog1.mark_delete == false
      assert changelog2.mark_delete == false
    end
  end

  describe "[cms changelog document]" do
    test "will create related document after create", ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      {:ok, changelog} =
        CMS.read_article(changelog.original_community_slug, :changelog, changelog.inner_id)

      assert not is_nil(changelog.document.body_html)

      {:ok, changelog} =
        CMS.read_article(changelog.original_community_slug, :changelog, changelog.inner_id, user)

      assert not is_nil(changelog.document.body_html)

      {:ok, article_doc} =
        ORM.find_by(ArticleDocument, %{article_id: changelog.id, thread: "CHANGELOG"})

      {:ok, changelog_doc} = ORM.find_by(ChangelogDocument, %{changelog_id: changelog.id})

      assert changelog.document.body == changelog_doc.body
      assert article_doc.body == changelog_doc.body
    end

    test "delete changelog should also delete related document",
         ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      {:ok, _article_doc} =
        ORM.find_by(ArticleDocument, %{article_id: changelog.id, thread: "CHANGELOG"})

      {:ok, _changelog_doc} = ORM.find_by(ChangelogDocument, %{changelog_id: changelog.id})

      {:ok, _} = CMS.delete_article(changelog)

      {:error, _} = ORM.find(Changelog, changelog.id)
      {:error, _} = ORM.find_by(ArticleDocument, %{article_id: changelog.id, thread: "CHANGELOG"})
      {:error, _} = ORM.find_by(ChangelogDocument, %{changelog_id: changelog.id})
    end

    test "update changelog should also update related document",
         ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      body = mock_rich_text(~s(new content))
      {:ok, changelog} = CMS.update_article(changelog, %{body: body})

      {:ok, article_doc} =
        ORM.find_by(ArticleDocument, %{article_id: changelog.id, thread: "CHANGELOG"})

      {:ok, changelog_doc} = ORM.find_by(ChangelogDocument, %{changelog_id: changelog.id})

      assert String.contains?(changelog_doc.body, "new content")
      assert String.contains?(article_doc.body, "new content")
    end
  end
end
