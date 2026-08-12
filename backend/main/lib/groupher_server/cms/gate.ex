defmodule GroupherServer.CMS.Gate do
  @moduledoc """
  Public facade for CMS operation admission.

  Community resource access (can/3 and check/3) composes the actor-independent
  Lifecycle capabilities with Community relations. Allow, Passport and
  PublishThrottle remain separate Gate seams.
  """

  alias __MODULE__.{Access, Allow, Passport, PublishThrottle}

  defdelegate allow_thread(community, thread), to: Allow, as: :thread
  defdelegate allow_emotion(community, scope, thread, emotion), to: Allow, as: :emotion
  defdelegate allow_comment(article), to: Allow, as: :comment

  defdelegate check_passport(user, passport_action, context), to: Passport, as: :check
  defdelegate get_passport(user), to: Passport
  defdelegate stamp_passport(rules, user), to: Passport
  defdelegate erase_passport(path, user), to: Passport
  defdelegate delete_passport(user), to: Passport
  defdelegate paged_passports(community, key), to: Passport
  defdelegate all_passport_rules(), to: Passport

  defdelegate can(user, action, community), to: Access
  defdelegate check(user, action, community), to: Access

  defdelegate check_publish_throttle(user, opts), to: PublishThrottle, as: :check
  defdelegate log_publish_action(user), to: PublishThrottle
end
