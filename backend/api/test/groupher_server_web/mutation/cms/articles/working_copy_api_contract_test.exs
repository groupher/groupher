defmodule GroupherServer.Test.Mutation.Articles.WorkingCopyAPIContract do
  @moduledoc false

  use GroupherServer.TestMate

  test "GraphQL forkSnapshot returns its WorkingCopy in the workingCopy field" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = GroupherServer.Test.ArticleContentFixture.community(actor)

    conn =
      :user
      |> simu_conn(actor)
      |> Plug.Conn.put_req_header("x-groupher-test-service-auth", "enabled")

    create_query = """
    mutation CreateAndPublishArticle(
      $community: String!,
      $thread: Thread!,
      $title: String!,
      $bodyBag: ArtimentBodyBagInput!,
      $commandId: ID!
    ) {
      createAndPublishArticle(
        community: $community,
        thread: $thread,
        title: $title,
        bodyBag: $bodyBag,
        commandId: $commandId
      ) {
        articleId
        snapshotId
      }
    }
    """

    published =
      gq_mutation(conn, create_query, %{
        community: community.slug,
        thread: "POST",
        title: "WorkingCopy fork source",
        bodyBag:
          mock_body_bag(mock_rich_text("published source body"))
          |> Map.update!(:thumbnail, &Jason.encode!/1),
        commandId: Ecto.UUID.generate()
      })

    fork_query = """
    mutation ForkSnapshot(
      $snapshotId: ID!,
      $community: String!,
      $scopeKind: String!,
      $scopeId: ID!,
      $commandId: ID!
    ) {
      forkSnapshot(
        snapshotId: $snapshotId,
        community: $community,
        scopeKind: $scopeKind,
        scopeId: $scopeId,
        commandId: $commandId
      ) {
        workingCopy {
          id
          articleId
          revision
          threadFields
        }
      }
    }
    """

    fork_scope_id = Ecto.UUID.generate()
    fork_command_id = Ecto.UUID.generate()

    fork_variables = %{
      snapshotId: published["snapshotId"],
      community: community.slug,
      scopeKind: "workspace",
      scopeId: fork_scope_id,
      commandId: fork_command_id
    }

    result = gq_mutation(conn, fork_query, fork_variables)
    retried = gq_mutation(conn, fork_query, fork_variables)

    assert %{
             "workingCopy" => %{
               "articleId" => article_id,
               "revision" => 1,
               "threadFields" => %{}
             }
           } = result

    assert article_id == published["articleId"]
    assert retried["workingCopy"]["id"] == result["workingCopy"]["id"]
  end

  test "GraphQL create, save, publish, and delete use Article WorkingCopy revision" do
    {:ok, actor} = db_insert(:user)
    {:ok, community} = GroupherServer.Test.ArticleContentFixture.community(actor)

    {:ok, tag} =
      CMS.Communities.create_tag(
        community,
        :post,
        mock_attrs(:community_tag),
        actor,
        Ecto.UUID.generate()
      )

    conn =
      :user
      |> simu_conn(actor)
      |> Plug.Conn.put_req_header("x-groupher-test-service-auth", "enabled")

    create_query = """
    mutation CreateArticle($community: String!, $thread: Thread!, $title: String!, $bodyBag: ArtimentBodyBagInput!, $tagIds: [ID], $commandId: ID!) {
      createArticle(community: $community, thread: $thread, title: $title, bodyBag: $bodyBag, tagIds: $tagIds, commandId: $commandId) {
        id articleId scopeKind revision title bodyJson tagIds
      }
    }
    """

    created =
      gq_mutation(conn, create_query, %{
        community: community.slug,
        thread: "POST",
        title: "Initial WorkingCopy",
        bodyBag:
          mock_body_bag(mock_rich_text("initial body"))
          |> Map.update!(:thumbnail, &Jason.encode!/1),
        tagIds: [tag.id],
        commandId: Ecto.UUID.generate()
      })

    assert created["scopeKind"] == "default"
    assert created["revision"] == 1
    assert created["bodyJson"] =~ "initial body"
    assert created["tagIds"] == [to_string(tag.id)]

    save_query = """
    mutation SaveWorkingCopy($articleId: ID!, $workingCopyId: ID!, $revision: Int!, $community: String!, $title: String!, $bodyBag: ArtimentBodyBagInput!, $tagIds: [ID], $commandId: ID!) {
      saveWorkingCopy(articleId: $articleId, workingCopyId: $workingCopyId, revision: $revision, community: $community, title: $title, bodyBag: $bodyBag, tagIds: $tagIds, commandId: $commandId) {
        id articleId revision title bodyJson tagIds
      }
    }
    """

    save_variables = %{
      articleId: created["articleId"],
      workingCopyId: created["id"],
      revision: created["revision"],
      community: community.slug,
      title: "Saved WorkingCopy",
      bodyBag:
        mock_body_bag(mock_rich_text("saved body"))
        |> Map.update!(:thumbnail, &Jason.encode!/1),
      tagIds: [],
      commandId: Ecto.UUID.generate()
    }

    saved = gq_mutation(conn, save_query, save_variables)
    assert saved["revision"] == 2
    assert saved["title"] == "Saved WorkingCopy"
    assert saved["bodyJson"] =~ "saved body"
    assert saved["tagIds"] == []

    stale_save =
      Map.merge(save_variables, %{title: "stale overwrite", commandId: Ecto.UUID.generate()})

    assert mutation_error?(conn, save_query, stale_save, 4561)

    publish_query = """
    mutation PublishArticle($articleId: ID!, $community: String!, $source: ArticleWorkingCopySourceInput!, $expectedPublicSnapshotId: ID, $commandId: ID!) {
      publishArticle(articleId: $articleId, community: $community, source: $source, expectedPublicSnapshotId: $expectedPublicSnapshotId, commandId: $commandId) {
        articleId snapshotId title
      }
    }
    """

    published =
      gq_mutation(conn, publish_query, %{
        articleId: created["articleId"],
        community: community.slug,
        source: %{workingCopyId: created["id"], revision: saved["revision"]},
        expectedPublicSnapshotId: nil,
        commandId: Ecto.UUID.generate()
      })

    assert published["snapshotId"]
    assert published["title"] == "Saved WorkingCopy"

    CMS.Gate.RateLimit.Publish.mock_publish_throttle_attr(
      :last_publish_time,
      %User{id: actor.id},
      minutes: -CMS.Gate.RateLimit.Publish.Config.publish_throttle().interval_minutes
    )

    selected =
      gq_mutation(conn, publish_query, %{
        articleId: created["articleId"],
        community: community.slug,
        source: %{snapshotId: published["snapshotId"]},
        expectedPublicSnapshotId: published["snapshotId"],
        commandId: Ecto.UUID.generate()
      })

    assert selected["snapshotId"] == published["snapshotId"]

    delete_query = """
    mutation DeleteWorkingCopy($articleId: ID!, $workingCopyId: ID!, $community: String!, $commandId: ID!) {
      deleteWorkingCopy(articleId: $articleId, workingCopyId: $workingCopyId, community: $community, commandId: $commandId) {
        __typename
      }
    }
    """

    deleted =
      gq_mutation(conn, delete_query, %{
        articleId: created["articleId"],
        workingCopyId: created["id"],
        community: community.slug,
        commandId: Ecto.UUID.generate()
      })

    assert deleted["__typename"] == "DoneState"
  end

  test "GraphQL exposes only the unified Article content mutation names" do
    assert {:ok, %{data: %{"__schema" => schema}}} =
             Absinthe.run(
               """
               {
                 __schema {
                   mutationType {
                     fields {
                       name
                       args { name }
                     }
                   }
                 }
               }
               """,
               GroupherServerWeb.Schema
             )

    fields = Map.new(schema["mutationType"]["fields"], &{&1["name"], &1["args"]})

    for field <- [
          "createArticle",
          "saveWorkingCopy",
          "forkSnapshot",
          "publishArticle",
          "createAndPublishArticle",
          "deleteWorkingCopy"
        ] do
      assert Map.has_key?(fields, field)
    end

    for field <- [
          "createPost",
          "createBlog",
          "createChangelog",
          "updatePost",
          "updateBlog",
          "updateChangelog",
          "updatePostDraft",
          "updateBlogDraft",
          "updateChangelogDraft",
          "discardPostDraft",
          "discardBlogDraft",
          "discardChangelogDraft",
          "updateArticleDraft",
          "discardArticleDraft",
          "publishPost",
          "publishBlog",
          "publishChangelog",
          "publishPostRevision",
          "publishBlogRevision",
          "publishChangelogRevision",
          "publishArticleRevision"
        ] do
      refute Map.has_key?(fields, field)
    end

    save_args = MapSet.new(Enum.map(fields["saveWorkingCopy"], & &1["name"]))
    delete_args = MapSet.new(Enum.map(fields["deleteWorkingCopy"], & &1["name"]))
    assert MapSet.member?(save_args, "revision")
    refute MapSet.member?(save_args, "expectedVersion")
    refute MapSet.member?(delete_args, "revision")
  end

  for thread <- [:blog, :changelog] do
    test "GraphQL uses the same WorkingCopy contract for #{thread}" do
      {:ok, actor} = db_insert(:user)
      {:ok, community} = GroupherServer.Test.ArticleContentFixture.community(actor)

      conn =
        :user
        |> simu_conn(actor)
        |> Plug.Conn.put_req_header("x-groupher-test-service-auth", "enabled")

      created =
        gq_mutation(
          conn,
          """
          mutation CreateArticle($community: String!, $thread: Thread!, $title: String!, $bodyBag: ArtimentBodyBagInput!, $commandId: ID!) {
            createArticle(community: $community, thread: $thread, title: $title, bodyBag: $bodyBag, commandId: $commandId) {
              id articleId revision
            }
          }
          """,
          %{
            community: community.slug,
            thread: String.upcase(Atom.to_string(unquote(thread))),
            title: "#{unquote(thread)} WorkingCopy",
            bodyBag:
              mock_body_bag(mock_rich_text("#{unquote(thread)} initial"))
              |> Map.update!(:thumbnail, &Jason.encode!/1),
            commandId: Ecto.UUID.generate()
          }
        )

      saved =
        gq_mutation(
          conn,
          """
          mutation SaveWorkingCopy($articleId: ID!, $workingCopyId: ID!, $revision: Int!, $community: String!, $title: String!, $bodyBag: ArtimentBodyBagInput!, $commandId: ID!) {
            saveWorkingCopy(articleId: $articleId, workingCopyId: $workingCopyId, revision: $revision, community: $community, title: $title, bodyBag: $bodyBag, commandId: $commandId) {
              articleId revision title bodyJson
            }
          }
          """,
          %{
            articleId: created["articleId"],
            workingCopyId: created["id"],
            revision: created["revision"],
            community: community.slug,
            title: "#{unquote(thread)} Saved",
            bodyBag:
              mock_body_bag(mock_rich_text("#{unquote(thread)} saved"))
              |> Map.update!(:thumbnail, &Jason.encode!/1),
            commandId: Ecto.UUID.generate()
          }
        )

      published =
        gq_mutation(
          conn,
          """
          mutation PublishArticle($articleId: ID!, $community: String!, $source: ArticleWorkingCopySourceInput!, $commandId: ID!) {
            publishArticle(articleId: $articleId, community: $community, source: $source, commandId: $commandId) {
              articleId snapshotId title
            }
          }
          """,
          %{
            articleId: created["articleId"],
            community: community.slug,
            source: %{workingCopyId: created["id"], revision: saved["revision"]},
            commandId: Ecto.UUID.generate()
          }
        )

      assert created["revision"] == 1
      assert saved["revision"] == 2
      assert saved["title"] == "#{unquote(thread)} Saved"
      assert saved["bodyJson"] =~ "#{unquote(thread)} saved"
      assert published["articleId"] == created["articleId"]
      assert published["snapshotId"]
      assert published["title"] == saved["title"]
    end
  end

  test "Article WorkingCopy uses the unified mutation names and revision input" do
    fields = GroupherServerWeb.Schema.__absinthe_type__(:mutation).fields

    assert Map.has_key?(fields, :create_article)
    assert Map.has_key?(fields, :save_working_copy)
    assert Map.has_key?(fields, :fork_snapshot)
    assert Map.has_key?(fields, :publish_article)
    assert Map.has_key?(fields, :create_and_publish_article)
    assert Map.has_key?(fields, :delete_working_copy)

    legacy_article_mutations = [
      :create_post,
      :create_post_draft,
      :update_post,
      :update_post_draft,
      :publish_post_draft,
      :create_blog,
      :create_blog_draft,
      :update_blog,
      :update_blog_draft,
      :publish_blog_draft,
      :create_changelog,
      :create_changelog_draft,
      :update_changelog,
      :update_changelog_draft,
      :publish_changelog_draft
    ]

    for legacy_field <- legacy_article_mutations do
      refute Map.has_key?(fields, legacy_field)
    end

    save_working_copy = fields.save_working_copy
    assert Map.has_key?(save_working_copy.args, :revision)
    refute Map.has_key?(save_working_copy.args, :expected_version)
    assert Map.has_key?(save_working_copy.args, :copy_right)
    assert Map.has_key?(save_working_copy.args, :link_addr)
    assert Map.has_key?(save_working_copy.args, :subtitle)
    assert Map.has_key?(save_working_copy.args, :template_key)
    assert Map.has_key?(save_working_copy.args, :cover_url)
    assert Map.has_key?(save_working_copy.args, :cover_url_dark)

    delete_working_copy = fields.delete_working_copy
    refute Map.has_key?(delete_working_copy.args, :revision)
    refute Map.has_key?(delete_working_copy.args, :expected_version)

    publish_article = fields.publish_article

    source =
      Absinthe.Schema.lookup_type(GroupherServerWeb.Schema, :article_working_copy_source_input)

    assert Map.has_key?(source.fields, :revision)
    assert Map.has_key?(source.fields, :working_copy_id)
    assert Map.has_key?(source.fields, :snapshot_id)
    refute Map.has_key?(publish_article.args, :expected_version)

    result = Absinthe.Schema.lookup_type(GroupherServerWeb.Schema, :article_working_copy_result)
    assert Map.has_key?(result.fields, :working_copy)

    working_copy = Absinthe.Schema.lookup_type(GroupherServerWeb.Schema, :article_working_copy)
    assert Map.has_key?(working_copy.fields, :revision)
    assert Map.has_key?(working_copy.fields, :thread_fields)
    refute Map.has_key?(working_copy.fields, :version)
    refute Map.has_key?(working_copy.fields, :body_hash)

    snapshot = Absinthe.Schema.lookup_type(GroupherServerWeb.Schema, :article_snapshot)
    refute Map.has_key?(snapshot.fields, :body_hash)
    assert Map.has_key?(snapshot.fields, :thread_fields)

    cover_edit = Absinthe.Schema.lookup_type(GroupherServerWeb.Schema, :cover_edit_info_input)
    assert Map.has_key?(cover_edit.fields, :format_version)
    refute Map.has_key?(cover_edit.fields, :version)
  end
end
