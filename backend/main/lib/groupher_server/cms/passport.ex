defmodule GroupherServer.CMS.Passport do
  @moduledoc """
  Ownership namespace for CMS Passport facts.

  Passport is shared authorization data, not a Gate child module. CRUD,
  registry, and authorization seams live below this namespace while Gate only
  consumes the authorization result.

      API / Gate policy
        -> CMS.Passport.Authorization
        -> CMS.Passport.Registry
        -> normalized Passport facts
  """

  alias __MODULE__.{Assignment, Authorization}

  @doc "Lists Passport assignments for a Community."
  defdelegate paged_passports(community, key), to: Assignment
  @doc "Returns the canonical Passport rule catalog."
  defdelegate all_passport_rules(), to: Assignment
  @doc "Loads the current Passport for a user."
  defdelegate get_passport(user), to: Assignment
  @doc "Assigns normalized Passport rules to a user."
  defdelegate stamp_passport(rules, user), to: Assignment
  @doc "Erases Passport rules at a path for a user."
  defdelegate erase_passport(path, user), to: Assignment
  @doc "Deletes the Passport assignment for a user."
  defdelegate delete_passport(user), to: Assignment

  @doc "Checks a Passport action against the supplied context."
  defdelegate check(user, action, context \\ %{}), to: Authorization
  @doc "Authorizes a review action through the Passport boundary."
  defdelegate authorize(user, action), to: Authorization
end
