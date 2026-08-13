defmodule GroupherServer.CMS.Gate do
  @moduledoc """
  Public facade for CMS operation admission.

  Community resource access (can/3 and check/3) composes the actor-independent
  Lifecycle capabilities with Community relations. Allow, Passport and
  PublishThrottle remain separate Gate seams.

  Business position:

      GraphQL resolver / domain caller
        -> CMS.Gate
        -> Access / Allow / Passport / PublishThrottle
        -> policy result or persisted throttle facts
  """

  alias __MODULE__.{Access, Allow, Passport, PublishThrottle}

  @doc "Returns whether a community enables the requested content thread."

  defdelegate allow_thread(community, thread), to: Allow, as: :thread
  @doc "Returns whether an emotion is enabled for the requested community scope."
  defdelegate allow_emotion(community, scope, thread, emotion), to: Allow, as: :emotion
  @doc "Returns whether the target artiment currently accepts comments."
  defdelegate allow_comment(article), to: Allow, as: :comment

  @doc "Checks a persisted Passport permission for the supplied context."

  defdelegate check_passport(user, passport_action, context), to: Passport, as: :check
  @doc "Returns the persisted Passport associated with a user."
  defdelegate get_passport(user), to: Passport
  @doc "Persists the supplied Passport rules for a user."
  defdelegate stamp_passport(rules, user), to: Passport
  @doc "Removes a rule path from a user Passport."
  defdelegate erase_passport(path, user), to: Passport
  @doc "Deletes the persisted Passport for a user."
  defdelegate delete_passport(user), to: Passport
  @doc "Returns paged Passports for the requested community key."
  defdelegate paged_passports(community, key), to: Passport
  @doc "Returns every registered Passport rule."
  defdelegate all_passport_rules(), to: Passport

  @doc "Returns whether an actor may perform an action in the supplied CMS context."

  defdelegate can(user, action, community), to: Access
  @doc "Returns the CMS authorization result for an actor, action, and context."
  defdelegate check(user, action, community), to: Access

  @doc "Checks whether the user may publish again under the configured rate policy."

  defdelegate check_publish_throttle(user, opts), to: PublishThrottle, as: :check
  @doc "Records a successful publication for later throttle decisions."
  defdelegate log_publish_action(user), to: PublishThrottle
end
