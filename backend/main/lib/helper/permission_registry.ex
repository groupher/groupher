defmodule Helper.PermissionRegistry do
  @moduledoc """
  Central permission registry for action-based authorization.

  Main responsibilities:

  - map GraphQL `action` strings to normalized permission requirements
  - normalize and validate passport rule payloads
  - provide known grant catalogs used by write-time validation and UI payloads

  Rule data structure (canonical):

      %{
        "global" => %{
          "community.create" => true,
          "god" => true
        },
        "<community_slug>" => %{
          "root" => true,
          "cms" => %{
            "post.edit" => true,
            "thread.set" => true
          }
        }
      }

  Requirement structure:

      %{scope: :global, grant: "community.create"}
      %{scope: :context, context: :cms, grant: "post.edit"}
      %{scope: :global, grant_by_thread: "community.unmirror"}

  Canonical passport shape:

      %{
        "global" => %{...},
        "community-slug" => %{
          "root" => true,
          "cms" => %{...}
        }
      }
  """

  alias Helper.PermissionConfig

  @root_passport_item_count 10_000
  @contexts PermissionConfig.contexts()
  @action_requirements PermissionConfig.action_requirements()

  @doc """
  Returns permission requirement metadata for an action.
  """
  @spec requirement(String.t()) :: {:ok, map()} | {:error, :unknown_action}
  def requirement(action) when is_binary(action) do
    case Map.get(@action_requirements, action) do
      nil -> {:error, :unknown_action}
      requirement -> {:ok, requirement}
    end
  end

  def requirement(_), do: {:error, :unknown_action}

  @doc """
  Returns supported moderator titles.
  """
  def moderator_titles(:cms), do: ["root", "moderator"]

  @doc """
  Returns sentinel passport item count for root moderators.
  """
  def root_passport_item_count, do: @root_passport_item_count

  @doc """
  Returns default passport rule examples for compatibility APIs.
  """
  def all_passport_rules do
    PermissionConfig.passport_rule_examples()
  end

  @doc """
  Returns all known grants for CMS split by global and context scopes.
  TODO: refactor later
  """
  def all_rules(:cms),
    do: %{
      general: PermissionConfig.grants_for("global"),
      community: PermissionConfig.grants_for("cms")
    }

  @doc """
  Returns all known grants encoded as JSON maps with false defaults.
  """
  def all_rules(:cms, :stringify) do
    rules = all_rules(:cms)

    %{
      general: rules.general |> Enum.map(fn x -> {x, false} end) |> Map.new() |> Jason.encode!(),
      community:
        rules.community |> Enum.map(fn x -> {x, false} end) |> Map.new() |> Jason.encode!()
    }
  end

  @doc """
  Returns canonical empty passport rules.
  """
  @spec empty_rules() :: map()
  def empty_rules, do: %{"global" => %{}}

  @doc """
  Validates whether rules contain only known keys per scope.
  """
  @spec valid_rules?(map()) :: boolean()
  def valid_rules?(rules) when is_map(rules) do
    normalized = normalize_rules(rules)

    valid_context_rules?("global", Map.get(normalized, "global", %{})) and
      normalized
      |> Map.drop(["global"])
      |> Enum.all?(fn {_community_slug, community_rules} ->
        valid_community_rules?(community_rules)
      end)
  rescue
    ArgumentError -> false
  end

  def valid_rules?(_), do: false

  @doc """
  Normalizes rules into the canonical `%{"global" => map, community_slug => map}` shape.
  """
  @spec normalize_rules(map() | nil) :: map()
  def normalize_rules(%{"global" => global, "cms" => legacy_cms} = rules)
      when is_map(global) and is_map(legacy_cms) do
    rules
    |> migrate_legacy_rules()
    |> normalize_rules()
  end

  def normalize_rules(%{"global" => global} = rules) when is_map(global) do
    base = %{"global" => normalize_context("global", global)}

    rules
    |> Map.drop(["global"])
    |> Enum.reduce(base, fn {community_slug, community_rules}, acc ->
      Map.put(acc, to_string(community_slug), normalize_community_rules(community_rules))
    end)
  end

  def normalize_rules(rules) when is_map(rules) do
    if map_has_atom_keys?(rules) do
      rules
      |> normalize_top_level_atom_keys()
      |> normalize_rules()
    else
      raise(ArgumentError, "invalid passport rules shape, expected global/community maps")
    end
  end

  def normalize_rules(nil), do: empty_rules()

  def normalize_rules(_),
    do: raise(ArgumentError, "invalid passport rules shape, expected global/community maps")

  @doc """
  Returns whether a permission key is known in either scope.
  """
  @spec valid_permission?(String.t()) :: boolean()
  def valid_permission?(permission) when is_binary(permission) do
    valid_context_permission?("global", permission) or
      Enum.any?(@contexts, &valid_context_permission?(&1, permission))
  end

  def valid_permission?(_), do: false

  @doc """
  Returns whether a key is valid for global scope.
  """
  @spec valid_global_permission?(String.t()) :: boolean()
  def valid_global_permission?(permission) when is_binary(permission),
    do: valid_context_permission?("global", permission)

  def valid_global_permission?(_), do: false

  @doc """
  Returns whether a key is valid for the given scope context.
  """
  @spec valid_context_permission?(String.t() | atom(), String.t()) :: boolean()
  def valid_context_permission?(context, permission) when is_atom(context),
    do: valid_context_permission?(to_string(context), permission)

  def valid_context_permission?(context, permission)
      when is_binary(context) and is_binary(permission) do
    permission in PermissionConfig.grants_for(context)
  end

  def valid_context_permission?(_, _), do: false

  defp valid_context_rules?("global", rules) when is_map(rules) do
    rules
    |> Enum.filter(fn {_key, value} -> value == true end)
    |> Enum.all?(fn {key, _} -> valid_context_permission?("global", key) end)
  end

  defp valid_context_rules?(context, rules) when is_binary(context) and is_map(rules) do
    rules
    |> Enum.filter(fn {_key, value} -> value == true end)
    |> Enum.all?(fn {key, _} -> valid_context_permission?(context, key) end)
  end

  defp valid_context_rules?(_, _), do: false

  defp valid_community_rules?(rules) when is_map(rules) do
    valid_root_rule?(Map.get(rules, "root")) and
      @contexts
      |> Enum.all?(fn context ->
        valid_context_rules?(context, Map.get(rules, context, %{}))
      end)
  end

  defp valid_community_rules?(_), do: false

  defp valid_root_rule?(nil), do: true
  defp valid_root_rule?(true), do: true
  defp valid_root_rule?(false), do: true
  defp valid_root_rule?(_), do: false

  defp normalize_permission_map(map) do
    Enum.reduce(map, %{}, fn {key, value}, acc ->
      case value do
        true -> Map.put(acc, to_string(key), true)
        false -> Map.put(acc, to_string(key), false)
        _ -> acc
      end
    end)
  end

  defp normalize_context("global", map) when is_map(map), do: normalize_permission_map(map)

  defp normalize_context(context, map) when is_binary(context) and is_map(map) do
    Enum.reduce(map, %{}, fn {scope_key, value}, acc ->
      if is_map(value) do
        Map.put(acc, to_string(scope_key), normalize_permission_map(value))
      else
        raise(ArgumentError, "invalid passport rules shape, expected configured context maps")
      end
    end)
  end

  defp normalize_context(_, _),
    do: raise(ArgumentError, "invalid passport rules shape, expected configured context maps")

  defp normalize_community_rules(map) when is_map(map) do
    map
    |> Enum.reduce(%{}, fn {key, value}, acc ->
      key = to_string(key)

      cond do
        key == "root" and is_boolean(value) ->
          Map.put(acc, key, value)

        key in @contexts and is_map(value) ->
          Map.put(acc, key, normalize_permission_map(value))

        true ->
          raise(ArgumentError, "invalid passport rules shape, expected community context maps")
      end
    end)
  end

  defp normalize_community_rules(_),
    do: raise(ArgumentError, "invalid passport rules shape, expected community context maps")

  defp migrate_legacy_rules(%{"global" => global, "cms" => cms}) do
    cms
    |> Enum.reduce(%{"global" => global}, fn {community_slug, cms_rules}, acc ->
      Map.put(acc, to_string(community_slug), %{"cms" => cms_rules})
    end)
  end

  defp normalize_top_level_atom_keys(map) do
    Enum.reduce(map, %{}, fn {key, value}, acc ->
      Map.put(acc, to_string(key), value)
    end)
  end

  defp map_has_atom_keys?(map) do
    Enum.any?(map, fn {key, _} -> is_atom(key) end)
  end
end
