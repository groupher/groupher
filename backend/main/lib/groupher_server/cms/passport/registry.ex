defmodule GroupherServer.CMS.Passport.Registry do
  @moduledoc """
  Canonical CMS Passport rule registry.

  This module owns rule shape, requirement, and normalization operations. It
  delegates the existing stable catalog implementation while keeping Gate out
  of Passport ownership.

      Passport consumer -> CMS.Passport.Registry -> permission catalog
  """

  alias Helper.PermissionRegistry

  @doc "Delegates action requirement lookup to `PermissionRegistry`."
  defdelegate requirement(action), to: PermissionRegistry

  @doc "Delegates passport grant checks to `PermissionRegistry`."
  defdelegate allowed?(passport, community, action), to: PermissionRegistry

  @doc "Delegates moderator title listing to `PermissionRegistry`."
  defdelegate moderator_titles(scope), to: PermissionRegistry

  @doc "Delegates the root moderator passport item count to `PermissionRegistry`."
  defdelegate root_passport_item_count(), to: PermissionRegistry

  @doc "Delegates the default passport rule catalog to `PermissionRegistry`."
  defdelegate all_passport_rules(), to: PermissionRegistry

  @doc "Delegates known grant listing for one scope to `PermissionRegistry`."
  defdelegate all_rules(scope), to: PermissionRegistry
  defdelegate all_rules(scope, format), to: PermissionRegistry

  @doc "Delegates the canonical empty rules payload to `PermissionRegistry`."
  defdelegate empty_rules(), to: PermissionRegistry

  @doc "Delegates passport rule validation to `PermissionRegistry`."
  defdelegate valid_rules?(rules), to: PermissionRegistry

  @doc "Delegates passport rule normalization to `PermissionRegistry`."
  defdelegate normalize_rules(rules), to: PermissionRegistry

  @doc "Delegates permission key validation to `PermissionRegistry`."
  defdelegate valid_permission?(permission), to: PermissionRegistry

  @doc "Delegates global-scope permission validation to `PermissionRegistry`."
  defdelegate valid_global_permission?(permission), to: PermissionRegistry

  @doc "Delegates context-scope permission validation to `PermissionRegistry`."
  defdelegate valid_context_permission?(context, permission), to: PermissionRegistry
end
