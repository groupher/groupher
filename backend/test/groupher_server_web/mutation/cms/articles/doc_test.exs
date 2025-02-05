defmodule GroupherServer.Test.Mutation.Articles.Doc do
  use GroupherServer.TestTools

  alias Helper.ORM
  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{Doc, Author}

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    doc_attrs = mock_attrs(:doc, %{community_id: community.id})
    {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, doc)

    {:ok, ~m(user_conn guest_conn owner_conn user community doc)a}
  end

  describe "[mutation doc curd]" do
    @create_doc_query """
    mutation(
      $title: String!
      $body: String!
      $communityId: ID!
      $articleTags: [ID]
      $linkAddr: String
    ) {
      createDoc(
        title: $title
        body: $body
        communityId: $communityId
        articleTags: $articleTags
        linkAddr: $linkAddr
      ) {
        id
        title
        linkAddr
        document {
          bodyHtml
        }
        originalCommunity {
          id
        }
      }
    }
    """

    test "create doc with valid attrs and make sure author exsit" do
      {:ok, user} = db_insert(:user)
      user_conn = simu_conn(:user, user)

      {:ok, community} = db_insert(:community)
      doc_attr = mock_attrs(:doc) |> Map.merge(%{linkAddr: "https://helloworld"})

      # body = """
      # {"time":1639375020110,"blocks":[{"type":"list","data":{"mode":"unordered_list","items":[{"text":"CP 的图标是字母 C (Coder / China) 和 Planet 的意象结合，斜向的条饰灵感来自于 NASA Logo 上的 \"red chevron\"。","label":null,"labelType":null,"checked":false,"hideLabel":true,"prefixIndex":"","indent":0},{"text":"所有的 Upvote 的图标都是小火箭，点击它会有一个起飞的动画 — 虽然它目前看起来像爆炸。。","label":null,"labelType":null,"checked":false,"hideLabel":true,"prefixIndex":"","indent":0}]}}],"version":"2.19.38"}
      # """
      body = """
      {"time":1639375020110,"blocks":[{"type":"list","data":{"mode":"unordered_list","items":[{"text":"CP 的图标是字母 C (Coder / China) 和 Planet 的意象结合，斜向的条饰灵感来自于 NASA Logo 上的 red chevron。","label":null,"labelType":null,"checked":false,"hideLabel":true,"prefixIndex":"","indent":0},{"text":"所有的 Upvote 的图标都是小火箭，点击它会有一个起飞的动画 — 虽然它目前看起来像爆炸。。","label":null,"labelType":null,"checked":false,"hideLabel":true,"prefixIndex":"","indent":0}]}}],"version":"2.19.38"}
      """

      variables = doc_attr |> Map.merge(%{communityId: community.id, body: body})

      created = user_conn |> mutation_result(@create_doc_query, variables, "createDoc")

      {:ok, doc} = ORM.find(Doc, created["id"])

      assert created["id"] == to_string(doc.id)
      assert created["originalCommunity"]["id"] == to_string(community.id)
      assert created["linkAddr"] == "https://helloworld"

      assert {:ok, _} = ORM.find_by(Author, user_id: user.id)
    end

    test "create doc with valid tags id list", ~m(user_conn user community)a do
      article_tag_attrs = mock_attrs(:article_tag)
      {:ok, article_tag} = CMS.create_article_tag(community, :doc, article_tag_attrs, user)

      doc_attr = mock_attrs(:doc)

      variables =
        doc_attr |> Map.merge(%{communityId: community.id, articleTags: [article_tag.id]})

      created = user_conn |> mutation_result(@create_doc_query, variables, "createDoc")

      {:ok, doc} = ORM.find(Doc, created["id"], preload: :article_tags)

      assert exist_in?(%{id: article_tag.id}, doc.article_tags)
    end

    test "create doc should excape xss attracts" do
      {:ok, user} = db_insert(:user)
      user_conn = simu_conn(:user, user)

      {:ok, community} = db_insert(:community)

      doc_attr = mock_attrs(:doc, %{body: mock_xss_string()})
      variables = doc_attr |> Map.merge(%{communityId: community.id}) |> camelize_map_key
      result = user_conn |> mutation_result(@create_doc_query, variables, "createDoc")
      {:ok, doc} = ORM.find(Doc, result["id"], preload: :document)
      body_html = doc |> get_in([:document, :body_html])

      assert not String.contains?(body_html, "script")
    end

    test "create doc should excape xss attracts 2" do
      {:ok, user} = db_insert(:user)
      user_conn = simu_conn(:user, user)

      {:ok, community} = db_insert(:community)

      doc_attr = mock_attrs(:doc, %{body: mock_xss_string(:safe)})
      variables = doc_attr |> Map.merge(%{communityId: community.id}) |> camelize_map_key
      result = user_conn |> mutation_result(@create_doc_query, variables, "createDoc")
      {:ok, doc} = ORM.find(Doc, result["id"], preload: :document)
      body_html = doc |> get_in([:document, :body_html])

      assert String.contains?(body_html, "&lt;script&gt;blackmail&lt;/script&gt;")
    end

    # NOTE: this test is IMPORTANT, cause json_codec: Jason in router will cause
    # server crash when GraphQL parse error

    test "create doc with missing non_null field should get 200 error" do
      {:ok, user} = db_insert(:user)
      user_conn = simu_conn(:user, user)

      {:ok, community} = db_insert(:community)
      doc_attr = mock_attrs(:doc)
      variables = doc_attr |> Map.merge(%{communityId: community.id}) |> Map.delete(:title)

      assert user_conn |> mutation_get_error?(@create_doc_query, variables)
    end

    @query """
    mutation($id: ID!){
      deleteDoc(id: $id) {
        id
      }
    }
    """

    test "delete a doc by doc's owner", ~m(owner_conn doc)a do
      deleted = owner_conn |> mutation_result(@query, %{id: doc.id}, "deleteDoc")

      assert deleted["id"] == to_string(doc.id)
      assert {:error, _} = ORM.find(Doc, deleted["id"])
    end

    test "can delete a doc by auth user", ~m(doc)a do
      doc = doc |> Repo.preload(:communities)
      belongs_community_title = doc.communities |> List.first() |> Map.get(:title)

      rule_conn = simu_conn(:user, cms: %{belongs_community_title => %{"doc.delete" => true}})

      deleted = rule_conn |> mutation_result(@query, %{id: doc.id}, "deleteDoc")

      assert deleted["id"] == to_string(doc.id)
      assert {:error, _} = ORM.find(Doc, deleted["id"])
    end

    test "delete a doc without login user fails", ~m(guest_conn doc)a do
      assert guest_conn |> mutation_get_error?(@query, %{id: doc.id}, ecode(:account_login))
    end

    test "login user with auth passport delete a doc", ~m(doc)a do
      doc = doc |> Repo.preload(:communities)
      doc_communities_0 = doc.communities |> List.first() |> Map.get(:title)
      passport_rules = %{doc_communities_0 => %{"doc.delete" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      # assert conn |> mutation_get_error?(@query, %{id: doc.id})

      deleted = rule_conn |> mutation_result(@query, %{id: doc.id}, "deleteDoc")

      assert deleted["id"] == to_string(doc.id)
    end

    test "unauth user delete doc fails", ~m(user_conn guest_conn doc)a do
      variables = %{id: doc.id}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@query, variables, ecode(:passport))
      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
      assert rule_conn |> mutation_get_error?(@query, variables, ecode(:passport))
    end

    @query """
    mutation($id: ID!, $title: String, $body: String, $articleTags: [ID]){
      updateDoc(id: $id, title: $title, body: $body, articleTags: $articleTags) {
        id
        title
        document {
          bodyHtml
        }
        meta {
          isEdited
        }
        commentsParticipants {
          id
          nickname
        }
        articleTags {
          id
        }
      }
    }
    """

    test "update a doc without login user fails", ~m(guest_conn doc)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: doc.id,
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
    end

    test "doc can be update by owner", ~m(owner_conn doc)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: doc.id,
        title: "updated title #{unique_num}",
        # body: mock_rich_text("updated body #{unique_num}"),,
        body: mock_rich_text("updated body #{unique_num}")
      }

      result = owner_conn |> mutation_result(@query, variables, "updateDoc")
      assert result["title"] == variables.title

      assert result
             |> get_in(["document", "bodyHtml"])
             |> String.contains?(~s(updated body #{unique_num}))

      assert result["title"] == variables.title
    end

    test "update doc with valid attrs should have is_edited meta info update",
         ~m(owner_conn doc)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: doc.id,
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      updated_doc = owner_conn |> mutation_result(@query, variables, "updateDoc")

      assert true == updated_doc["meta"]["isEdited"]
    end

    test "login user with auth passport update a doc", ~m(doc)a do
      doc = doc |> Repo.preload(:communities)
      belongs_community_title = doc.communities |> List.first() |> Map.get(:title)

      passport_rules = %{belongs_community_title => %{"doc.edit" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      # assert conn |> mutation_get_error?(@query, %{id: doc.id})
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: doc.id,
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      updated_doc = rule_conn |> mutation_result(@query, variables, "updateDoc")

      assert updated_doc["id"] == to_string(doc.id)
    end

    test "unauth user update doc fails", ~m(user_conn guest_conn doc)a do
      unique_num = System.unique_integer([:positive, :monotonic])

      variables = %{
        id: doc.id,
        title: "updated title #{unique_num}",
        body: mock_rich_text("updated body #{unique_num}")
      }

      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@query, variables, ecode(:passport))
      assert guest_conn |> mutation_get_error?(@query, variables, ecode(:account_login))
      assert rule_conn |> mutation_get_error?(@query, variables, ecode(:passport))
    end
  end
end
