defmodule GroupherServer.Test.CMS.Events.Cite.BlogTest do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Events
  alias CMS.Model.CitedArtiment

  @site_host get_config(:general, :site_host)

  setup do
    {community, blog, _, user} = mock_article(:blog)
    {:ok, user2} = db_insert(:user)

    blog_attrs = mock_attrs(:blog, %{community_id: community.id, author: %{user: user}})
    {:ok, blog2} = CMS.Articles.create(community, :blog, blog_attrs, user)

    {:ok, blog3} = db_insert(:blog)
    {:ok, blog4} = db_insert(:blog)
    {:ok, blog5} = db_insert(:blog)

    {:ok, ~m(user user2 community blog blog2 blog3 blog4 blog5 blog_attrs)a}
  end

  describe "[cite basic]" do
    test "cited multi blog should work",
         ~m(user community blog2 blog3 blog4 blog5 blog_attrs)a do
      body =
        mock_rich_text(
          ~s(the <a href=#{@site_host}/blog/#{blog2.id} /> and <a href=#{@site_host}/blog/#{blog2.id}>same la</a> is awesome, the <a href=#{@site_host}/blog/#{blog3.id}></a> is awesome too.),
          ~s(the paragraph 2 <a href=#{@site_host}/blog/#{blog2.id} class=#{blog2.title}> again</a>, the paragraph 2 <a href=#{@site_host}/blog/#{blog4.id}> again</a>, the paragraph 2 <a href=#{@site_host}/blog/#{blog5.id}> again</a>)
        )

      blog_attrs = blog_attrs |> Map.merge(%{body: body})
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

      body = mock_rich_text(~s(the <a href=#{@site_host}/blog/#{blog3.id} />))
      blog_attrs = blog_attrs |> Map.merge(%{body: body})
      {:ok, blog_n} = CMS.Articles.create(community, :blog, blog_attrs, user)

      Events.emit(:cite, %{artiment: blog})
      Events.emit(:cite, %{artiment: blog_n})

      {:ok, blog2} = ORM.find(Blog, blog2.id)
      {:ok, blog3} = ORM.find(Blog, blog3.id)
      {:ok, blog4} = ORM.find(Blog, blog4.id)
      {:ok, blog5} = ORM.find(Blog, blog5.id)

      assert blog2.meta.citing_count == 1
      assert blog3.meta.citing_count == 2
      assert blog4.meta.citing_count == 1
      assert blog5.meta.citing_count == 1
    end

    test "cited blog itself should not work", ~m(user community blog_attrs)a do
      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

      body = mock_rich_text(~s(the <a href=#{@site_host}/blog/#{blog.id} />))
      {:ok, blog} = CMS.Articles.update(blog, %{body: body})

      Events.emit(:cite, %{artiment: blog})

      {:ok, blog} = ORM.find(Blog, blog.id)
      assert blog.meta.citing_count == 0
    end

    test "cited comment itself should not work", ~m(user community blog)a do
      {:ok, cited_comment} =
        CMS.Comments.create_comment(
          community,
          :blog,
          blog.inner_id,
          mock_rich_text("hello"),
          user
        )

      {:ok, comment} =
        CMS.Comments.update_comment(
          cited_comment,
          mock_comment(
            ~s(the <a href=#{@site_host}/blog/#{blog.id}?comment_id=#{cited_comment.id} />)
          )
        )

      Events.emit(:cite, %{artiment: comment})

      {:ok, cited_comment} = ORM.find(Comment, cited_comment.id)
      assert cited_comment.meta.citing_count == 0
    end

    test "can cite blog's comment in blog",
         ~m(user community blog blog2 blog_attrs)a do
      {:ok, comment} =
        CMS.Comments.create_comment(
          community,
          :blog,
          blog.inner_id,
          mock_rich_text("hello"),
          user
        )

      body =
        mock_rich_text(~s(the <a href=#{@site_host}/blog/#{blog2.id}?comment_id=#{comment.id} />))

      blog_attrs = blog_attrs |> Map.merge(%{body: body})

      {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
      Events.emit(:cite, %{artiment: blog})

      {:ok, comment} = ORM.find(Comment, comment.id)
      assert comment.meta.citing_count == 1

      {:ok, cited_content} = ORM.find_by(CitedArtiment, %{cited_by_id: comment.id})

      assert cited_content.blog_id == blog.id
      assert cited_content.cited_by_type == "COMMENT"
    end

    test "can cite a comment in a comment", ~m(user community blog)a do
      {:ok, cited_comment} =
        CMS.Comments.create_comment(
          community,
          :blog,
          blog.inner_id,
          mock_rich_text("hello"),
          user
        )

      comment_body =
        mock_rich_text(
          ~s(the <a href=#{@site_host}/blog/#{blog.id}?comment_id=#{cited_comment.id} />)
        )

      {:ok, comment} =
        CMS.Comments.create_comment(community, :blog, blog.inner_id, comment_body, user)

      Events.emit(:cite, %{artiment: comment})

      {:ok, cited_comment} = ORM.find(Comment, cited_comment.id)
      assert cited_comment.meta.citing_count == 1

      {:ok, cited_content} = ORM.find_by(CitedArtiment, %{cited_by_id: cited_comment.id})
      assert comment.id == cited_content.comment_id
      assert cited_comment.id == cited_content.cited_by_id
      assert cited_content.cited_by_type == "COMMENT"
    end

    test "can cited blog inside a comment",
         ~m(user community blog blog2 blog3 blog4 blog5)a do
      comment_body =
        mock_rich_text(
          ~s(the <a href=#{@site_host}/blog/#{blog2.id} /> and <a href=#{@site_host}/blog/#{blog2.id}>same la</a> is awesome, the <a href=#{@site_host}/blog/#{blog3.id}></a> is awesome too.),
          ~s(the paragraph 2 <a href=#{@site_host}/blog/#{blog2.id} class=#{blog2.title}> again</a>, the paragraph 2 <a href=#{@site_host}/blog/#{blog4.id}> again</a>, the paragraph 2 <a href=#{@site_host}/blog/#{blog5.id}> again</a>)
        )

      {:ok, comment} =
        CMS.Comments.create_comment(community, :blog, blog.inner_id, comment_body, user)

      Events.emit(:cite, %{artiment: comment})

      comment_body = mock_rich_text(~s(the <a href=#{@site_host}/blog/#{blog3.id} />))

      {:ok, comment} =
        CMS.Comments.create_comment(community, :blog, blog.inner_id, comment_body, user)

      Events.emit(:cite, %{artiment: comment})

      {:ok, blog2} = ORM.find(Blog, blog2.id)
      {:ok, blog3} = ORM.find(Blog, blog3.id)
      {:ok, blog4} = ORM.find(Blog, blog4.id)
      {:ok, blog5} = ORM.find(Blog, blog5.id)

      assert blog2.meta.citing_count == 1
      assert blog3.meta.citing_count == 2
      assert blog4.meta.citing_count == 1
      assert blog5.meta.citing_count == 1
    end
  end

  describe "[cite pagi]" do
    test "can get paged cited articles.", ~m(user community blog2 blog_attrs)a do
      {:ok, comment} =
        CMS.Comments.create_comment(
          community,
          :blog,
          blog2.inner_id,
          mock_comment(~s(the <a href=#{@site_host}/blog/#{blog2.id} />)),
          user
        )

      Process.sleep(1000)

      body =
        mock_rich_text(
          ~s(the <a href=#{@site_host}/blog/#{blog2.id} />),
          ~s(the <a href=#{@site_host}/blog/#{blog2.id} />)
        )

      blog_attrs = blog_attrs |> Map.merge(%{body: body})
      {:ok, blog_x} = CMS.Articles.create(community, :blog, blog_attrs, user)

      Process.sleep(1000)
      body = mock_rich_text(~s(the <a href=#{@site_host}/blog/#{blog2.id} />))
      blog_attrs = blog_attrs |> Map.merge(%{body: body})
      {:ok, blog_y} = CMS.Articles.create(community, :blog, blog_attrs, user)

      Events.emit(:cite, %{artiment: blog_x})
      Events.emit(:cite, %{artiment: comment})
      Events.emit(:cite, %{artiment: blog_y})

      {:ok, result} = CMS.Articles.paged_citing_contents("BLOG", blog2.id, %{page: 1, size: 10})

      entries = result.entries

      result_comment = entries |> List.first()
      result_blog_x = entries |> Enum.at(1)
      result_blog_y = entries |> List.last()

      article_map_keys = [:block_linker, :id, :inserted_at, :thread, :title, :user] |> Enum.sort()

      assert result_comment.comment_id == comment.id
      assert result_comment.id == blog2.id
      assert result_comment.title == blog2.title

      assert result_blog_x.id == blog_x.id
      assert result_blog_x.block_linker |> length == 2
      assert result_blog_x |> Map.keys() |> Enum.sort() == article_map_keys

      assert result_blog_y.id == blog_y.id
      assert result_blog_y.block_linker |> length == 1
      assert result_blog_y |> Map.keys() |> Enum.sort() == article_map_keys

      assert result |> is_valid_pagination?(:raw)
      assert result.total_count == 3
    end
  end

  describe "[cross cite]" do
    test "can citing multi type thread and comment in one time", ~m(user community blog2)a do
      blog_attrs = mock_attrs(:blog, %{community_id: community.id})
      post_attrs = mock_attrs(:post, %{community_id: community.id})

      body = mock_rich_text(~s(the <a href=#{@site_host}/blog/#{blog2.id} />))

      {:ok, blog} =
        CMS.Articles.create(community, :blog, Map.merge(blog_attrs, %{body: body}), user)

      Events.emit(:cite, %{artiment: blog})

      Process.sleep(1000)

      {:ok, post} =
        CMS.Articles.create(community, :post, Map.merge(post_attrs, %{body: body}), user)

      Events.emit(:cite, %{artiment: post})

      {:ok, result} = CMS.Articles.paged_citing_contents("BLOG", blog2.id, %{page: 1, size: 10})

      assert result.total_count == 2

      result_blog = result.entries |> List.first()
      result_post = result.entries |> List.last()

      assert result_blog.id == blog.id
      assert result_blog.thread == :blog

      assert result_post.id == post.id
      assert result_post.thread == :post
    end
  end
end
