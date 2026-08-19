defmodule GroupherServer.CMS.Comments.ErrorCat do
  @moduledoc false

  use GroupherServer.ErrorCat.Domain, namespace: {:cms, :comment}

  error(:create_comment, code: 4401)
  error(:comment_already_upvote, code: 4402)
  error(:comment_pin_limit, code: 4403)
  error(:update_fails, code: 4404)
  error(:create_fails, code: 4405)
  error(:delete_fails, code: 4406)
  error(:invalid_body, code: 4407)
  error(:lifecycle_not_found, code: 4408)
  error(:require_questioner, code: 4409)
  error(:archived, code: 4411)
  error(:not_exist, code: 4412)
  error(:lifecycle_state_conflict, code: 4413)
  error(:comment_archive_retired, code: 4414)
  error(:already_pinned, code: 4415)
end
