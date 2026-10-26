defmodule GroupherServer.Test.Jobs.NonCommandWriteJobs do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.Jobs

  test "retention and cleanup workers return tagged success on an empty scope" do
    job = %Oban.Job{}

    assert {:ok, :pass} = Jobs.CommandReceiptRetention.perform(job)
    assert {:ok, :pass} = Jobs.ExpireCommunityApplicationLogoUploads.perform(job)
    assert {:ok, :pass} = Jobs.ExpireCommunityApplications.perform(job)
    assert {:ok, :pass} = Jobs.ProfileViewDedupeCleanup.perform(job)
    assert {:ok, :pass} = Jobs.ReleaseExpiredCommunitySlugClaims.perform(job)
    assert {:ok, :pass} = Jobs.CMSArtimentReviewRetention.perform(job)
    assert {:ok, :pass} = Jobs.ViewDedupeCleanup.perform(job)
    assert {:ok, :pass} = Jobs.WallpaperLifecycle.perform(job)
  end
end
