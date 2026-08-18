defmodule GroupherServer.CMS.Articles.ErrorCat do
  @moduledoc false

  use GroupherServer.ErrorCat.Domain, namespace: {:cms, :article}

  error(:too_much_pinned_article, code: 6001)
  error(:mirror_article, code: 6002)
  error(:undo_sink_old_article, code: 6003)
  error(:archived, code: 6004)
  error(:invalid_blog_title, code: 6005)
  error(:already_upvoted, code: 6006)
  error(:pending, code: 6007)
  error(:article_not_found, code: 6008)
  error(:emotion_not_allowed, code: 6009)
  error(:thread_not_visible, code: 6010)
  error(:not_exist, code: 6011)
  error(:projection_not_updated, code: 6012, retryable: true)
  error(:lifecycle_not_found, code: 6013)
  error(:lifecycle_state_conflict, code: 6014)
  error(:document_not_found, code: 6015)
  error(:draft_version_required, code: 6016)
  error(:draft_conflict, code: 6017)
end
