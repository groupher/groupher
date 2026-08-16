defmodule GroupherServer.Test.CMS.Hash do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Model.{Doc, DocSnapshot}

  describe "[cms hash]" do
    test "article version hash matches doc tree change detection hash" do
      draft = %Doc{body_hash: "body-hash", title: "Draft", digest: "Draft", subtitle: "Intro"}

      public_snapshot = %DocSnapshot{
        version_hash: CMS.Docs.Snapshot.version_hash(draft)
      }

      refute CMS.DocTree.ChangeDetection.draft_content_changed?(draft, public_snapshot)
    end

    test "article version hash includes subtitle" do
      draft = %Doc{
        body_hash: "body-hash",
        title: "Draft",
        digest: "Draft",
        subtitle: "Updated intro"
      }

      original = %{draft | subtitle: "Intro"}

      public_snapshot = %DocSnapshot{
        version_hash: CMS.Docs.Snapshot.version_hash(original)
      }

      assert CMS.DocTree.ChangeDetection.draft_content_changed?(draft, public_snapshot)
    end
  end
end
