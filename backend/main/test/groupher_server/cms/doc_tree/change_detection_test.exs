defmodule GroupherServer.Test.CMS.DocTree.ChangeDetection do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Model.Doc

  describe "[doc tree change detection]" do
    test "treats missing public snapshot as changed" do
      draft = %Doc{body_hash: "body-hash", title: "Draft", digest: "Draft", subtitle: "Intro"}

      assert CMS.DocTree.ChangeDetection.draft_content_changed?(draft, nil)
    end
  end
end
