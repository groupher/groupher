defmodule GroupherServer.Test.CMS.Hash do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS.DocTree.ChangeDetection
  alias GroupherServer.CMS.Model.{ArticleRevision, DocDraft}

  describe "[cms hash]" do
    test "Doc change detection compares canonical content hashes" do
      draft = %DocDraft{content_hash: "same-hash"}
      public_revision = %ArticleRevision{content_hash: "same-hash"}

      refute ChangeDetection.draft_content_changed?(draft, public_revision)
    end

    test "Doc change detection reports different canonical content hashes" do
      draft = %DocDraft{content_hash: "draft-hash"}
      public_revision = %ArticleRevision{content_hash: "public-hash"}

      assert ChangeDetection.draft_content_changed?(draft, public_revision)
    end
  end
end
