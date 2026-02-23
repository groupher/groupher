defmodule GroupherServer.Test.CMS.Events.Cite.DocTest do
  @moduledoc false

  use GroupherServer.TestTools

  alias CMS.Model.CitedArtiment
  alias CMS.Events

  @site_host get_config(:general, :site_host)

  setup do
    {community, doc, _, user} = mock_article(:doc)
    {:ok, user2} = db_insert(:user)

    doc_attrs = mock_attrs(:doc, %{community_id: community.id, author: %{user: user}})
    {:ok, doc2} = CMS.Articles.create(community, :doc, doc_attrs, user)

    {:ok, doc3} = db_insert(:doc)
    {:ok, doc4} = db_insert(:doc)
    {:ok, doc5} = db_insert(:doc)

    {:ok, ~m(user user2 community doc doc2 doc3 doc4 doc5 doc_attrs)a}
  end

  describe "[cite basic]" do
    test "cited multi doc should work",
         ~m(user community doc2 doc3 doc4 doc5 doc_attrs)a do
      body =
        mock_rich_text(
          ~s(the <a href=#{@site_host}/doc/#{doc2.id} /> and <a href=#{@site_host}/doc/#{doc2.id}>same la</a> is awesome, the <a href=#{@site_host}/doc/#{doc3.id}></a> is awesome too.),
          ~s(the paragraph 2 <a href=#{@site_host}/doc/#{doc2.id} class=#{doc2.title}> again</a>, the paragraph 2 <a href=#{@site_host}/doc/#{doc4.id}> again</a>, the paragraph 2 <a href=#{@site_host}/doc/#{doc5.id}> again</a>)
        )

      doc_attrs = doc_attrs |> Map.merge(%{body: body})
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

      body = mock_rich_text(~s(the <a href=#{@site_host}/doc/#{doc3.id} />))
      doc_attrs = doc_attrs |> Map.merge(%{body: body})
      {:ok, doc_n} = CMS.Articles.create(community, :doc, doc_attrs, user)

      Events.emit(:cite, %{artiment: doc})
      Events.emit(:cite, %{artiment: doc_n})

      {:ok, doc2} = ORM.find(Doc, doc2.id)
      {:ok, doc3} = ORM.find(Doc, doc3.id)
      {:ok, doc4} = ORM.find(Doc, doc4.id)
      {:ok, doc5} = ORM.find(Doc, doc5.id)

      assert doc2.meta.citing_count == 1
      assert doc3.meta.citing_count == 2
      assert doc4.meta.citing_count == 1
      assert doc5.meta.citing_count == 1
    end

    test "cited doc itself should not work", ~m(user community doc_attrs)a do
      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

      body = mock_rich_text(~s(the <a href=#{@site_host}/doc/#{doc.id} />))
      {:ok, doc} = CMS.Articles.update(doc, %{body: body})

      Events.emit(:cite, %{artiment: doc})

      {:ok, doc} = ORM.find(Doc, doc.id)
      assert doc.meta.citing_count == 0
    end

    test "cited comment itself should not work", ~m(user community doc)a do
      {:ok, cited_comment} =
        CMS.Comments.create_comment(
          community,
          :doc,
          doc.inner_id,
          mock_rich_text("hello"),
          user
        )

      {:ok, comment} =
        CMS.Comments.update_comment(
          cited_comment,
          mock_comment(
            ~s(the <a href=#{@site_host}/doc/#{doc.id}?comment_id=#{cited_comment.id} />)
          )
        )

      Events.emit(:cite, %{artiment: comment})

      {:ok, cited_comment} = ORM.find(Comment, cited_comment.id)
      assert cited_comment.meta.citing_count == 0
    end

    test "can cite doc's comment in doc",
         ~m(user community doc doc2 doc_attrs)a do
      {:ok, comment} =
        CMS.Comments.create_comment(
          community,
          :doc,
          doc.inner_id,
          mock_rich_text("hello"),
          user
        )

      body =
        mock_rich_text(~s(the <a href=#{@site_host}/doc/#{doc2.id}?comment_id=#{comment.id} />))

      doc_attrs = doc_attrs |> Map.merge(%{body: body})

      {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)
      Events.emit(:cite, %{artiment: doc})

      {:ok, comment} = ORM.find(Comment, comment.id)
      assert comment.meta.citing_count == 1

      {:ok, cited_content} = ORM.find_by(CitedArtiment, %{cited_by_id: comment.id})

      assert cited_content.doc_id == doc.id
      assert cited_content.cited_by_type == "COMMENT"
    end

    test "can cite a comment in a comment", ~m(user community doc)a do
      {:ok, cited_comment} =
        CMS.Comments.create_comment(
          community,
          :doc,
          doc.inner_id,
          mock_rich_text("hello"),
          user
        )

      comment_body =
        mock_rich_text(
          ~s(the <a href=#{@site_host}/doc/#{doc.id}?comment_id=#{cited_comment.id} />)
        )

      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, comment_body, user)

      Events.emit(:cite, %{artiment: comment})

      {:ok, cited_comment} = ORM.find(Comment, cited_comment.id)
      assert cited_comment.meta.citing_count == 1

      {:ok, cited_content} = ORM.find_by(CitedArtiment, %{cited_by_id: cited_comment.id})
      assert comment.id == cited_content.comment_id
      assert cited_comment.id == cited_content.cited_by_id
      assert cited_content.cited_by_type == "COMMENT"
    end

    test "can cited doc inside a comment",
         ~m(user community doc doc2 doc3 doc4 doc5)a do
      comment_body =
        mock_rich_text(
          ~s(the <a href=#{@site_host}/doc/#{doc2.id} /> and <a href=#{@site_host}/doc/#{doc2.id}>same la</a> is awesome, the <a href=#{@site_host}/doc/#{doc3.id}></a> is awesome too.),
          ~s(the paragraph 2 <a href=#{@site_host}/doc/#{doc2.id} class=#{doc2.title}> again</a>, the paragraph 2 <a href=#{@site_host}/doc/#{doc4.id}> again</a>, the paragraph 2 <a href=#{@site_host}/doc/#{doc5.id}> again</a>)
        )

      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, comment_body, user)

      Events.emit(:cite, %{artiment: comment})

      comment_body = mock_rich_text(~s(the <a href=#{@site_host}/doc/#{doc3.id} />))

      {:ok, comment} =
        CMS.Comments.create_comment(community, :doc, doc.inner_id, comment_body, user)

      Events.emit(:cite, %{artiment: comment})

      {:ok, doc2} = ORM.find(Doc, doc2.id)
      {:ok, doc3} = ORM.find(Doc, doc3.id)
      {:ok, doc4} = ORM.find(Doc, doc4.id)
      {:ok, doc5} = ORM.find(Doc, doc5.id)

      assert doc2.meta.citing_count == 1
      assert doc3.meta.citing_count == 2
      assert doc4.meta.citing_count == 1
      assert doc5.meta.citing_count == 1
    end
  end

  describe "[cite pagi]" do
    test "can get paged cited articles.", ~m(user community doc2 doc_attrs)a do
      {:ok, comment} =
        CMS.Comments.create_comment(
          community,
          :doc,
          doc2.inner_id,
          mock_comment(~s(the <a href=#{@site_host}/doc/#{doc2.id} />)),
          user
        )

      Process.sleep(1000)

      body =
        mock_rich_text(
          ~s(the <a href=#{@site_host}/doc/#{doc2.id} />),
          ~s(the <a href=#{@site_host}/doc/#{doc2.id} />)
        )

      doc_attrs = doc_attrs |> Map.merge(%{body: body})
      {:ok, doc_x} = CMS.Articles.create(community, :doc, doc_attrs, user)

      Process.sleep(1000)
      body = mock_rich_text(~s(the <a href=#{@site_host}/doc/#{doc2.id} />))
      doc_attrs = doc_attrs |> Map.merge(%{body: body})
      {:ok, doc_y} = CMS.Articles.create(community, :doc, doc_attrs, user)

      Events.emit(:cite, %{artiment: doc_x})
      Events.emit(:cite, %{artiment: comment})
      Events.emit(:cite, %{artiment: doc_y})

      {:ok, result} = CMS.Articles.paged_citing_contents("DOC", doc2.id, %{page: 1, size: 10})

      entries = result.entries

      result_comment = entries |> List.first()
      result_doc_x = entries |> Enum.at(1)
      result_doc_y = entries |> List.last()

      article_map_keys = [:block_linker, :id, :inserted_at, :thread, :title, :user] |> Enum.sort()

      assert result_comment.comment_id == comment.id
      assert result_comment.id == doc2.id
      assert result_comment.title == doc2.title

      assert result_doc_x.id == doc_x.id
      assert result_doc_x.block_linker |> length == 2
      assert result_doc_x |> Map.keys() |> Enum.sort() == article_map_keys

      assert result_doc_y.id == doc_y.id
      assert result_doc_y.block_linker |> length == 1
      assert result_doc_y |> Map.keys() |> Enum.sort() == article_map_keys

      assert result |> is_valid_pagination?(:raw)
      assert result.total_count == 3
    end
  end

  describe "[cross cite]" do
    test "can citing multi type thread and comment in one time", ~m(user community doc2)a do
      doc_attrs = mock_attrs(:doc, %{community_id: community.id})
      blog_attrs = mock_attrs(:blog, %{community_id: community.id})

      body = mock_rich_text(~s(the <a href=#{@site_host}/doc/#{doc2.id} />))

      {:ok, doc} =
        CMS.Articles.create(community, :doc, Map.merge(doc_attrs, %{body: body}), user)

      Events.emit(:cite, %{artiment: doc})

      Process.sleep(1000)

      {:ok, blog} =
        CMS.Articles.create(community, :blog, Map.merge(blog_attrs, %{body: body}), user)

      Events.emit(:cite, %{artiment: blog})

      {:ok, result} = CMS.Articles.paged_citing_contents("DOC", doc2.id, %{page: 1, size: 10})

      assert result.total_count == 2

      result_doc = result.entries |> List.first()
      result_blog = result.entries |> List.last()

      assert result_doc.id == doc.id
      assert result_doc.thread == :doc

      assert result_blog.id == blog.id
      assert result_blog.thread == :blog
    end
  end
end
