defmodule GroupherServer.Test.CMS.Articles.Versioning.Changelog do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.Activity.Model.ChangelogLog

  test "keeps an ordinary Changelog draft until explicit publish" do
    {community, public, _attrs, user} = mock_article(:changelog)

    {:ok, draft} =
      CMS.Articles.update_draft(
        community,
        :changelog,
        public.article_hash_id,
        %{title: "Changelog draft", expected_version: public.version},
        user
      )

    assert draft.stage == :draft
    refute Map.has_key?(draft, :branch_id)

    assert {:ok, public_again} =
             CMS.Articles.read_public(community, :changelog, public.article_hash_id)

    assert public_again.title == public.title

    {:ok, %{article: published, snapshot: nil}} =
      CMS.Articles.publish_draft(community, :changelog, public.article_hash_id, user)

    assert published.title == "Changelog draft"

    released =
      ChangelogLog
      |> where([log], log.changelog_ref == ^public.article_hash_id and log.action == :released)
      |> order_by([log], desc: log.id)
      |> limit(1)
      |> Repo.one!()

    assert released.occurred_at
    assert released.actor_ref == user.login

    assert {:error, _} =
             CMS.Articles.read_draft(community, :changelog, public.article_hash_id)
  end
end
