defmodule GroupherServer.Test.Query.CMS.ArtimentMentions do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.ArtimentMentions

  @site_host get_config(:general, :site_host)

  setup do
    {community, post, post_attrs, user} = mock_article(:post)
    {_, blog, _, _} = mock_article(:blog, community, user)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community post post_attrs blog user)a}
  end

  describe "[query artiment mentions]" do
    @mentions_query """
    query($type: MentionType!, $id: ID!, $filter: PagiFilter!) {
      mentions(type: $type, id: $id, filter: $filter) {
        entries {
          mentionerType
          mentionerId
          mentionerCommunityId
          mentionedScope
          mentionedType
          mentionedId
          mentionedCommunityId
          mentionedUrl
          mentionCase
          occurrences
        }
        totalCount
        pageSize
        pageNumber
      }
    }
    """

    @mentioned_by_query """
    query($type: MentionType!, $id: ID!, $filter: PagiFilter!) {
      mentionedBy(type: $type, id: $id, filter: $filter) {
        entries {
          mentionerType
          mentionerId
          mentionerCommunityId
          mentionedType
          mentionedId
          mentionedCommunityId
          mentionCase
        }
        totalCount
        pageSize
        pageNumber
      }
    }
    """

    @mentions_without_filter_query """
    query($type: MentionType!, $id: ID!) {
      mentions(type: $type, id: $id) {
        entries {
          mentionerType
          mentionerId
          mentionedType
          mentionedId
        }
        totalCount
      }
    }
    """

    test "can query mentions and mentionedBy", ~m(guest_conn community post_attrs blog user)a do
      body =
        Jason.encode!([
          %{
            "type" => "p",
            "id" => "block-a",
            "children" => [
              %{"text" => ~s(<a href="#{@site_host}/blog/#{blog.id}">blog</a>)},
              %{"text" => " https://example.com/a"}
            ]
          }
        ])

      {:ok, post} =
        CMS.Articles.create(community, :post, Map.merge(post_attrs, %{body: body}), user)

      {:ok, {2, nil}} = ArtimentMentions.sync(post)

      variables = %{type: "POST", id: post.id, filter: %{page: 1, size: 10}}
      mentions = guest_conn |> gq_query(@mentions_query, variables)

      assert mentions["totalCount"] == 2

      internal = Enum.find(mentions["entries"], &(&1["mentionedType"] == "BLOG"))
      assert internal["mentionCase"] == "INLINE_MENTION"
      assert internal["mentionedId"] == to_string(blog.id)
      assert internal["mentionerCommunityId"] == to_string(community.id)
      assert internal["mentionedCommunityId"] == to_string(community.id)

      external = Enum.find(mentions["entries"], &(&1["mentionedType"] == "URL"))
      assert external["mentionCase"] == "LINK"
      assert external["mentionedUrl"] == "https://example.com/a"
      assert external["mentionerCommunityId"] == to_string(community.id)
      assert external["mentionedCommunityId"] == nil

      mentioned_by =
        guest_conn
        |> gq_query(@mentioned_by_query, %{
          type: "BLOG",
          id: blog.id,
          filter: %{page: 1, size: 10}
        })

      assert mentioned_by["totalCount"] == 1
      mention = mentioned_by["entries"] |> List.first()
      assert mention["mentionerType"] == "POST"
      assert mention["mentionerId"] == to_string(post.id)
      assert mention["mentionerCommunityId"] == to_string(community.id)
      assert mention["mentionedCommunityId"] == to_string(community.id)
    end

    test "can query mentions without filter", ~m(guest_conn community post_attrs blog user)a do
      body =
        Jason.encode!([
          %{
            "type" => "p",
            "id" => "block-a",
            "children" => [
              %{"text" => ~s(<a href="#{@site_host}/blog/#{blog.id}">blog</a>)}
            ]
          }
        ])

      {:ok, post} =
        CMS.Articles.create(community, :post, Map.merge(post_attrs, %{body: body}), user)

      {:ok, {1, nil}} = ArtimentMentions.sync(post)

      variables = %{type: "POST", id: post.id}
      mentions = guest_conn |> gq_query(@mentions_without_filter_query, variables)

      assert mentions["totalCount"] == 1
      mention = mentions["entries"] |> List.first()
      assert mention["mentionedType"] == "BLOG"
      assert mention["mentionedId"] == to_string(blog.id)
    end
  end
end
