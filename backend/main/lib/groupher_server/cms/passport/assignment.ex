defmodule GroupherServer.CMS.Passport.Assignment do
  @moduledoc """
  Passport assignment and persistence seam.

  CRUD remains owned by the Community Passport domain; this module exposes that
  assignment contract without making Gate the owner of Passport data.

      Community administration -> CMS.Passport.Assignment -> Passport rows
  """

  alias GroupherServer.CMS.Communities.Passport

  @doc "Delegates paged passport listing for one community scope to `Communities.Passport`."
  defdelegate paged_passports(community, key), to: Passport

  @doc "Delegates the default passport rule catalog to `Communities.Passport`."
  defdelegate all_passport_rules(), to: Passport

  @doc "Delegates normalized passport reading for one user to `Communities.Passport`."
  defdelegate get_passport(user), to: Passport

  @doc "Delegates passport rule stamping to `Communities.Passport`."
  defdelegate stamp_passport(rules, user), to: Passport

  @doc "Delegates passport rule erasure to `Communities.Passport`."
  defdelegate erase_passport(path, user), to: Passport

  @doc "Delegates passport deletion to `Communities.Passport`."
  defdelegate delete_passport(user), to: Passport
end
