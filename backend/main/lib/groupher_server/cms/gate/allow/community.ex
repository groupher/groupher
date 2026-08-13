defmodule GroupherServer.CMS.Gate.Allow.Community do
  @moduledoc """
  Compatibility adapter for the existing community Allow rules.

  Business position:

      CMS operation
        -> CMS.Gate
        -> Community
        -> allow / deny
        -> domain context
  """

  alias GroupherServer.CMS.CanCan.Communities, as: Legacy

  defdelegate allow_thread(community, thread), to: Legacy
  defdelegate allow_emotion(community, scope, thread, emotion), to: Legacy
  defdelegate allow_comment(article, user), to: Legacy
  def allow_comment(article), do: Legacy.allow_comment(article, nil)
  defdelegate allowed_emotions(community, scope, thread), to: Legacy
  defdelegate emotions_whitelist(), to: Legacy
  defdelegate default_thread_emotions(), to: Legacy
  defdelegate thread_keys(), to: Legacy
end
