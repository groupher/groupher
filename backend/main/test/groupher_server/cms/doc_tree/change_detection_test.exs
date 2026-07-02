defmodule GroupherServer.Test.CMS.DocTree.ChangeDetection do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Model.{ArticleSnapshot, Doc}

  describe "[doc tree change detection]" do
    test "treats missing public snapshot as changed" do
      draft = %Doc{content_hash: "body-hash", subtitle: "Intro"}

      assert CMS.DocTree.ChangeDetection.draft_content_changed?(draft, nil)
    end

    test "compares draft content against article snapshot hash shape" do
      draft = %Doc{content_hash: "body-hash", subtitle: "Intro"}

      public_snapshot = %ArticleSnapshot{
        content_hash: CMS.Hash.article_snapshot_content_hash(draft.content_hash, draft.subtitle)
      }

      refute CMS.DocTree.ChangeDetection.draft_content_changed?(draft, public_snapshot)
    end

    test "detects subtitle-only changes" do
      draft = %Doc{content_hash: "body-hash", subtitle: "Updated intro"}

      public_snapshot = %ArticleSnapshot{
        content_hash: CMS.Hash.article_snapshot_content_hash(draft.content_hash, "Intro")
      }

      assert CMS.DocTree.ChangeDetection.draft_content_changed?(draft, public_snapshot)
    end
  end
end
