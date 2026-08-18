defmodule GroupherServer.CMS.Gate.RateLimit.ErrorCat do
  @moduledoc false

  use GroupherServer.ErrorCat.Domain, namespace: {:cms, :gate, :rate_limit}

  error(:throttle_interval, code: 4201)
  error(:throttle_hour, code: 4202)
  error(:throttle_day, code: 4203)
end
