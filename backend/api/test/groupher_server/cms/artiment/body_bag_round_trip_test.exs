defmodule GroupherServer.CMS.Artiment.BodyBagRoundTripTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.ArticlePublicBody

  test "trusted Node v3 Tabs survive Article publication and public body projection" do
    root = Path.expand("../../../../../..", __DIR__)
    tsx = Path.join(root, "backend/auth/node_modules/.bin/tsx")

    script = ~S"""
    import { publishArtiment } from './packages/content-publisher/index.ts';
    (async () => {
      const value = [{ type: 'tabs', children: [
        { type: 'tab', label: 'First', value: 'one', children: [{ type: 'p', children: [{ text: 'First tab content with sufficient text.' }] }] },
        { type: 'tab', label: 'Second', value: 'two', children: [{ type: 'p', children: [{ text: 'Second tab content with sufficient text.' }] }] }
      ] }];
      console.log(JSON.stringify({ tabs: await publishArtiment(value), empty: await publishArtiment([{ type: 'p', children: [{ text: '' }] }]) }));
    })();
    """

    {output, 0} = System.cmd(tsx, ["-e", script], cd: root, stderr_to_stdout: true)
    result = Jason.decode!(output)
    bag = result["tabs"]
    assert {:ok, empty} = CMS.Artiment.BodyBag.cast(result["empty"], thread: :doc)

    assert Jason.decode!(Jason.encode!(Map.from_struct(empty))) ==
             Jason.decode!(Jason.encode!(CMS.Artiment.BodyBag.empty_doc()))

    assert bag["schemaVersion"] == CMS.ContentPublishContract.body_schema_version()
    assert bag["html"] =~ "First"
    assert bag["html"] =~ "Second"
    assert bag["markdown"] =~ "<tabs>"

    {:ok, actor} = db_insert(:user)
    {:ok, community} = mock_community(actor)

    assert {:ok, %{article: article}} =
             CMS.Articles.create_and_publish_article(
               community,
               :post,
               %{title: "Tabs round trip", body_bag: bag},
               actor,
               command_id: Ecto.UUID.generate()
             )

    public = Repo.get!(ArticlePublicBody, article.id)
    assert public.schema_version == 3
    assert Jason.decode!(public.json) == Jason.decode!(bag["json"])
    assert public.html == bag["html"]
    assert public.html =~ "First tab content"
    assert public.html =~ "Second tab content"

    render_script = ~S"""
    import React from './frontend/core/node_modules/react/index.js';
    import { renderToStaticMarkup } from './frontend/core/node_modules/react-dom/server.node.js';
    import { RichEditorStatic } from './frontend/core/node_modules/@groupher/rich-editor/dist/static.js';
    const value = JSON.parse(process.argv[1]);
    console.log(renderToStaticMarkup(React.createElement(RichEditorStatic, { value })));
    """

    {rendered, 0} =
      System.cmd(tsx, ["-e", render_script, public.json], cd: root, stderr_to_stdout: true)

    assert rendered =~ ~s(role="tablist")
    assert rendered =~ "First"
    assert rendered =~ "Second"
    assert rendered =~ "First tab content"
  end

  test "v1 and v2 stored Article bodies remain readable" do
    for version <- [1, 2] do
      {:ok, actor} = db_insert(:user)
      {:ok, community} = mock_community(actor)
      bag = mock_body_bag(mock_rich_text("Legacy version body content for reading."))
      bag = Map.put(bag, :schemaVersion, version)

      assert {:ok, %{article: article, snapshot: snapshot}} =
               CMS.Articles.create_and_publish_article(
                 community,
                 :post,
                 %{title: "Legacy version #{version}", body_bag: bag},
                 actor,
                 command_id: Ecto.UUID.generate()
               )

      document = CMS.Articles.Body.document(Repo.get!(CMS.Model.ArticleSnapshot, snapshot.id))
      assert document.schema_version == version
      assert document.json == bag.json
      assert Repo.get!(ArticlePublicBody, article.id).schema_version == version
    end
  end

  test "deleted Comment persists its v3 tombstone as a readable paragraph" do
    {community, post, _, actor} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        post.inner_id,
        mock_comment("Original comment content"),
        actor,
        Ecto.UUID.generate()
      )

    before = Repo.get_by!(CMS.Model.CommentBody, comment_id: comment.id)
    {:ok, %{comment: deleted}} = CMS.Comments.delete_comment(comment, actor, Ecto.UUID.generate())
    body = Repo.get_by!(CMS.Model.CommentBody, comment_id: comment.id)
    hint = CMS.Model.Comment.delete_hint()

    assert body.version == before.version + 1
    assert body.schema_version == CMS.ContentPublishContract.body_schema_version()

    assert {:ok, [%{"type" => "p", "children" => [%{"text" => ^hint}]}]} =
             CMS.Artiment.PlateJSON.decode(body.json)

    assert body.plain_text == hint and body.digest == hint
    assert body.markdown == hint <> "\n"
    assert body.html == "<p>" <> hint <> "</p>"
    assert body.body_hash == :crypto.hash(:sha256, body.json) |> Base.encode16(case: :lower)
    assert deleted.body.plain_text == body.plain_text
  end
end
