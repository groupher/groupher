defmodule GroupherServer.CMS.Passport.ErrorCat do
  @moduledoc false

  use GroupherServer.ErrorCat.Domain, namespace: {:cms, :passport}

  error(:passport, code: 4351)
  error(:unknown_action, code: 4352)
  error(:permission_denied, code: 4353)
  error(:unknown_passport_action, code: 4354)
  error(:review_permission_denied, code: 4355)
  error(:invalid_passport_shape, code: 4356)
  error(:community_required, code: 4357)
  error(:unknown_role, code: 4358)
end
