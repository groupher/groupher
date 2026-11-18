defmodule GroupherServer.Test.CMS.Passport.CatalogTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Passport.Catalog

  test "validates grant scope, values, grantability and dependencies" do
    assert {:ok, %{"article.read_draft" => true, "article.update" => true}} =
             Catalog.validate_permissions(:article, %{
               "article.read_draft" => true,
               "article.update" => true,
               "article.publish" => false
             })

    assert {:error, :permission_dependency_missing} =
             Catalog.validate_permissions(:article, %{"article.update" => true})

    assert {:error, :permission_scope_mismatch} =
             Catalog.validate_permissions(:article, %{"doc.queue.write" => true})

    assert {:error, :permission_not_grantable} =
             Catalog.validate_permissions(:article, %{"article.author.manage" => true})

    assert {:error, :unknown_action} =
             Catalog.validate_permissions(:article, %{"article.unknown" => true})

    assert {:error, :invalid_permission_value} =
             Catalog.validate_permissions(:article, %{"article.read_draft" => "true"})
  end

  test "Doc thread dependencies do not leak into other threads" do
    assert {:ok, ["community.article.trash.read", "doc.queue.write"]} =
             Catalog.requirements("community.article.hide", :doc)

    assert {:ok, ["community.article.trash.read"]} =
             Catalog.requirements("community.article.hide", :post)

    assert {:error, :unknown_thread} = Catalog.requirements("community.article.hide", :bogus)
    assert {:error, :unknown_thread} = Catalog.requirements("community.article.hide", 1)

    assert {:ok, ["community.article.trash.read"]} =
             Catalog.requirements("community.article.hide", nil)
  end
end
