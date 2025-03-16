defmodule GroupherServer.Test.CMS.Hooks.CiteChangelog do
  @moduledoc false

  use GroupherServer.TestTools

  alias CMS.Model.{CitedArtiment}
  alias CMS.Delegate.Hooks

  @site_host get_config(:general, :site_host)

  setup do
    {community, changelog, _, user} = mock_article(:changelog)
    {:ok, user2} = db_insert(:user)

    changelog_attrs = mock_attrs(:changelog, %{community_id: community.id, author: %{user: user}})
    {:ok, changelog2} = CMS.create_article(community, :changelog, changelog_attrs, user)

    {:ok, changelog3} = db_insert(:changelog)
    {:ok, changelog4} = db_insert(:changelog)
    {:ok, changelog5} = db_insert(:changelog)

    {:ok,
     ~m(user user2 community changelog changelog2 changelog3 changelog4 changelog5 changelog_attrs)a}
  end

  describe "[cite basic]" do
    test "cited multi changelog should work",
         ~m(user community changelog2 changelog3 changelog4 changelog5 changelog_attrs)a do
      body =
        mock_rich_text(
          ~s(the <a href=#{@site_host}/changelog/#{changelog2.id} /> and <a href=#{@site_host}/changelog/#{changelog2.id}>same la</a> is awesome, the <a href=#{@site_host}/changelog/#{changelog3.id}></a> is awesome too.),
          # second paragraph
          ~s(the paragraph 2 <a href=#{@site_host}/changelog/#{changelog2.id} class=#{changelog2.title}> again</a>, the paragraph 2 <a href=#{@site_host}/changelog/#{changelog4.id}> again</a>, the paragraph 2 <a href=#{@site_host}/changelog/#{changelog5.id}> again</a>)
        )

      changelog_attrs = changelog_attrs |> Map.merge(%{body: body})
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      body = mock_rich_text(~s(the <a href=#{@site_host}/changelog/#{changelog3.id} />))
      changelog_attrs = changelog_attrs |> Map.merge(%{body: body})
      {:ok, changelog_n} = CMS.create_article(community, :changelog, changelog_attrs, user)

      Hooks.Cite.handle(changelog)
      Hooks.Cite.handle(changelog_n)

      {:ok, changelog2} = ORM.find(Changelog, changelog2.id)
      {:ok, changelog3} = ORM.find(Changelog, changelog3.id)
      {:ok, changelog4} = ORM.find(Changelog, changelog4.id)
      {:ok, changelog5} = ORM.find(Changelog, changelog5.id)

      assert changelog2.meta.citing_count == 1
      assert changelog3.meta.citing_count == 2
      assert changelog4.meta.citing_count == 1
      assert changelog5.meta.citing_count == 1
    end

    test "cited changelog itself should not work", ~m(user community changelog_attrs)a do
      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

      body = mock_rich_text(~s(the <a href=#{@site_host}/changelog/#{changelog.id} />))
      {:ok, changelog} = CMS.update_article(changelog, %{body: body})

      Hooks.Cite.handle(changelog)

      {:ok, changelog} = ORM.find(Changelog, changelog.id)
      assert changelog.meta.citing_count == 0
    end

    test "cited comment itself should not work", ~m(user community changelog)a do
      {:ok, cited_comment} =
        CMS.create_comment(
          community,
          :changelog,
          changelog.inner_id,
          mock_rich_text("hello"),
          user
        )

      {:ok, comment} =
        CMS.update_comment(
          cited_comment,
          mock_comment(
            ~s(the <a href=#{@site_host}/changelog/#{changelog.id}?comment_id=#{cited_comment.id} />)
          )
        )

      Hooks.Cite.handle(comment)

      {:ok, cited_comment} = ORM.find(Comment, cited_comment.id)
      assert cited_comment.meta.citing_count == 0
    end

    test "can cite changelog's comment in changelog",
         ~m(user community changelog changelog2 changelog_attrs)a do
      {:ok, comment} =
        CMS.create_comment(
          community,
          :changelog,
          changelog.inner_id,
          mock_rich_text("hello"),
          user
        )

      body =
        mock_rich_text(
          ~s(the <a href=#{@site_host}/changelog/#{changelog2.id}?comment_id=#{comment.id} />)
        )

      changelog_attrs = changelog_attrs |> Map.merge(%{body: body})

      {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
      Hooks.Cite.handle(changelog)

      {:ok, comment} = ORM.find(Comment, comment.id)
      assert comment.meta.citing_count == 1

      {:ok, cited_content} = ORM.find_by(CitedArtiment, %{cited_by_id: comment.id})

      # 被 changelog 以 comment link 的方式引用了
      assert cited_content.changelog_id == changelog.id
      assert cited_content.cited_by_type == "COMMENT"
    end

    test "can cite a comment in a comment", ~m(user community changelog)a do
      {:ok, cited_comment} =
        CMS.create_comment(
          community,
          :changelog,
          changelog.inner_id,
          mock_rich_text("hello"),
          user
        )

      comment_body =
        mock_rich_text(
          ~s(the <a href=#{@site_host}/changelog/#{changelog.id}?comment_id=#{cited_comment.id} />)
        )

      {:ok, comment} =
        CMS.create_comment(community, :changelog, changelog.inner_id, comment_body, user)

      Hooks.Cite.handle(comment)

      {:ok, cited_comment} = ORM.find(Comment, cited_comment.id)
      assert cited_comment.meta.citing_count == 1

      {:ok, cited_content} = ORM.find_by(CitedArtiment, %{cited_by_id: cited_comment.id})
      assert comment.id == cited_content.comment_id
      assert cited_comment.id == cited_content.cited_by_id
      assert cited_content.cited_by_type == "COMMENT"
    end

    test "can cited changelog inside a comment",
         ~m(user community changelog changelog2 changelog3 changelog4 changelog5)a do
      comment_body =
        mock_rich_text(
          ~s(the <a href=#{@site_host}/changelog/#{changelog2.id} /> and <a href=#{@site_host}/changelog/#{changelog2.id}>same la</a> is awesome, the <a href=#{@site_host}/changelog/#{changelog3.id}></a> is awesome too.),
          # second paragraph
          ~s(the paragraph 2 <a href=#{@site_host}/changelog/#{changelog2.id} class=#{changelog2.title}> again</a>, the paragraph 2 <a href=#{@site_host}/changelog/#{changelog4.id}> again</a>, the paragraph 2 <a href=#{@site_host}/changelog/#{changelog5.id}> again</a>)
        )

      {:ok, comment} =
        CMS.create_comment(community, :changelog, changelog.inner_id, comment_body, user)

      Hooks.Cite.handle(comment)

      comment_body = mock_rich_text(~s(the <a href=#{@site_host}/changelog/#{changelog3.id} />))

      {:ok, comment} =
        CMS.create_comment(community, :changelog, changelog.inner_id, comment_body, user)

      Hooks.Cite.handle(comment)

      {:ok, changelog2} = ORM.find(Changelog, changelog2.id)
      {:ok, changelog3} = ORM.find(Changelog, changelog3.id)
      {:ok, changelog4} = ORM.find(Changelog, changelog4.id)
      {:ok, changelog5} = ORM.find(Changelog, changelog5.id)

      assert changelog2.meta.citing_count == 1
      assert changelog3.meta.citing_count == 2
      assert changelog4.meta.citing_count == 1
      assert changelog5.meta.citing_count == 1
    end
  end

  describe "[cite pagi]" do
    test "can get paged cited articles.", ~m(user community changelog2 changelog_attrs)a do
      {:ok, comment} =
        CMS.create_comment(
          community,
          :changelog,
          changelog2.inner_id,
          mock_comment(~s(the <a href=#{@site_host}/changelog/#{changelog2.id} />)),
          user
        )

      Process.sleep(1000)

      body =
        mock_rich_text(
          ~s(the <a href=#{@site_host}/changelog/#{changelog2.id} />),
          ~s(the <a href=#{@site_host}/changelog/#{changelog2.id} />)
        )

      changelog_attrs = changelog_attrs |> Map.merge(%{body: body})
      {:ok, changelog_x} = CMS.create_article(community, :changelog, changelog_attrs, user)

      Process.sleep(1000)
      body = mock_rich_text(~s(the <a href=#{@site_host}/changelog/#{changelog2.id} />))
      changelog_attrs = changelog_attrs |> Map.merge(%{body: body})
      {:ok, changelog_y} = CMS.create_article(community, :changelog, changelog_attrs, user)

      Hooks.Cite.handle(changelog_x)
      Hooks.Cite.handle(comment)
      Hooks.Cite.handle(changelog_y)

      {:ok, result} = CMS.paged_citing_contents("CHANGELOG", changelog2.id, %{page: 1, size: 10})

      entries = result.entries

      result_comment = entries |> List.first()
      result_changelog_x = entries |> Enum.at(1)
      result_changelog_y = entries |> List.last()

      article_map_keys = [:block_linker, :id, :inserted_at, :thread, :title, :user] |> Enum.sort()

      assert result_comment.comment_id == comment.id
      assert result_comment.id == changelog2.id
      assert result_comment.title == changelog2.title

      assert result_changelog_x.id == changelog_x.id
      assert result_changelog_x.block_linker |> length == 2
      assert result_changelog_x |> Map.keys() |> Enum.sort() == article_map_keys

      assert result_changelog_y.id == changelog_y.id
      assert result_changelog_y.block_linker |> length == 1
      assert result_changelog_y |> Map.keys() |> Enum.sort() == article_map_keys

      assert result |> is_valid_pagination?(:raw)
      assert result.total_count == 3
    end
  end

  describe "[cross cite]" do
    test "can citing multi type thread and comment in one time", ~m(user community changelog2)a do
      changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})
      blog_attrs = mock_attrs(:blog, %{community_id: community.id})

      body = mock_rich_text(~s(the <a href=#{@site_host}/changelog/#{changelog2.id} />))

      {:ok, changelog} =
        CMS.create_article(community, :changelog, Map.merge(changelog_attrs, %{body: body}), user)

      Hooks.Cite.handle(changelog)

      Process.sleep(1000)

      {:ok, blog} =
        CMS.create_article(community, :blog, Map.merge(blog_attrs, %{body: body}), user)

      Hooks.Cite.handle(blog)

      {:ok, result} = CMS.paged_citing_contents("CHANGELOG", changelog2.id, %{page: 1, size: 10})

      assert result.total_count == 2

      result_changelog = result.entries |> List.first()
      result_blog = result.entries |> List.last()

      assert result_changelog.id == changelog.id
      assert result_changelog.thread == :changelog

      assert result_blog.id == blog.id
      assert result_blog.thread == :blog
    end
  end
end
