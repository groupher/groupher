defmodule GroupherServer.Test.CMS.Hash do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Model.{ArticleSnapshot, Doc}

  describe "[cms hash]" do
    test "article snapshot content hash matches doc tree change detection hash" do
      draft = %Doc{content_hash: "body-hash", subtitle: "Intro"}

      public_snapshot = %ArticleSnapshot{
        content_hash: CMS.Hash.article_snapshot_content_hash(draft.content_hash, draft.subtitle)
      }

      refute CMS.DocTree.ChangeDetection.draft_content_changed?(draft, public_snapshot)
    end

    test "article snapshot content hash includes subtitle" do
      draft = %Doc{content_hash: "body-hash", subtitle: "Updated intro"}

      public_snapshot = %ArticleSnapshot{
        content_hash: CMS.Hash.article_snapshot_content_hash(draft.content_hash, "Intro")
      }

      assert CMS.DocTree.ChangeDetection.draft_content_changed?(draft, public_snapshot)
    end
  end
end
