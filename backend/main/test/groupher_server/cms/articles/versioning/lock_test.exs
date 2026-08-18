defmodule GroupherServer.Test.CMS.Articles.Versioning.MutationLock do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Articles.MutationLock

  test "Doc lock keys are scoped by branch" do
    {community, _existing_post, _attrs, _user} = mock_article(:post)
    article_hash_id = Ecto.UUID.generate()

    refute MutationLock.doc_key(community, 11, article_hash_id) ==
             MutationLock.doc_key(community, 12, article_hash_id)

    assert MutationLock.key(community, :post, article_hash_id) !=
             MutationLock.doc_key(community, 11, article_hash_id)
  end
end
