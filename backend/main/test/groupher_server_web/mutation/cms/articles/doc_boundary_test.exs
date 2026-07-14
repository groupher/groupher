defmodule GroupherServer.Test.Mutation.Articles.DocBoundary do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, doc, _attrs, _user} = mock_article(:doc)
    {:ok, community: community, doc: doc}
  end

  test "Docs content creation and editing are not exposed as Main mutations" do
    mutation_fields = GroupherServerWeb.Schema.__absinthe_type__(:mutation).fields

    refute Map.has_key?(mutation_fields, :create_doc)
    refute Map.has_key?(mutation_fields, :update_doc)
    assert Map.has_key?(mutation_fields, :update_doc_draft)
    assert Map.has_key?(mutation_fields, :publish_doc_changes)
  end

  test "Docs Article deletion is routed through the Tree lifecycle", context do
    owner_conn = simu_conn(:owner, context.doc)

    assert owner_conn
           |> mutation_error?(S.Article.m(:trash_article), %{
        article: %{
          inner_id: context.doc.inner_id,
          community: context.community.slug,
          thread: "DOC"
        }
      })

    assert {:ok, _} = CMS.Articles.read(context.community, :doc, context.doc.inner_id)
  end
end
