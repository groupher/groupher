defmodule GroupherServer.CMS.Gate.Passport.Registry do
  @moduledoc "Gate-owned registry facade over the existing Passport registry."

  alias Helper.PermissionRegistry, as: Legacy

  defdelegate requirement(action), to: Legacy
  defdelegate allowed?(passport, community, action), to: Legacy
  defdelegate moderator_titles(scope), to: Legacy
  defdelegate root_passport_item_count(), to: Legacy
  defdelegate all_passport_rules(), to: Legacy
  defdelegate all_rules(scope), to: Legacy
  defdelegate all_rules(scope, format), to: Legacy
  defdelegate empty_rules(), to: Legacy
  defdelegate valid_rules?(rules), to: Legacy
  defdelegate normalize_rules(rules), to: Legacy
  defdelegate valid_permission?(permission), to: Legacy
  defdelegate valid_global_permission?(permission), to: Legacy
  defdelegate valid_context_permission?(context, permission), to: Legacy
end
