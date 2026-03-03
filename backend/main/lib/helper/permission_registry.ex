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
          "root" => true
        },
        "cms" => %{
          "<community_slug>" => %{
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
        "cms" => %{"community-slug" => %{...}}
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
  TODO: refactor later.
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
  def empty_rules, do: %{"global" => %{}, "cms" => %{}}

  @doc """
  Validates whether rules contain only known keys per scope.
  """
  @spec valid_rules?(map()) :: boolean()
  def valid_rules?(rules) when is_map(rules) do
    normalized = normalize_rules(rules)

    @contexts
    |> Enum.all?(fn context ->
      valid_context_rules?(context, Map.get(normalized, context, %{}))
    end)
  rescue
    ArgumentError -> false
  end

  def valid_rules?(_), do: false

  @doc """
  Normalizes rules into `%{"global" => map, "cms" => map}` with string keys.
  """
  @spec normalize_rules(map() | nil) :: map()
  def normalize_rules(%{"global" => global} = rules) when is_map(global) do
    validate_top_level_keys!(Map.keys(rules))

    base = %{"global" => normalize_context("global", global)}

    Enum.reduce(Enum.reject(@contexts, &(&1 == "global")), base, fn context, acc ->
      context_value = Map.get(rules, context, %{})
      Map.put(acc, context, normalize_context(context, context_value))
    end)
  end

  def normalize_rules(rules) when is_map(rules) do
    if map_has_atom_keys?(rules) do
      rules
      |> normalize_top_level_atom_keys()
      |> normalize_rules()
    else
      raise(ArgumentError, "invalid passport rules shape, expected context maps")
    end
  end

  def normalize_rules(nil), do: empty_rules()

  def normalize_rules(_),
    do: raise(ArgumentError, "invalid passport rules shape, expected configured context maps")

  @doc """
  Returns whether a permission key is known in either scope.
  """
  @spec valid_permission?(String.t()) :: boolean()
  def valid_permission?(permission) when is_binary(permission) do
    @contexts
    |> Enum.any?(&valid_context_permission?(&1, permission))
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
    |> Enum.all?(fn {_scope_key, permission_map} ->
      is_map(permission_map) and
        permission_map
        |> Enum.filter(fn {_key, value} -> value == true end)
        |> Enum.all?(fn {key, _} -> valid_context_permission?(context, key) end)
    end)
  end

  defp valid_context_rules?(_, _), do: false

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

  defp validate_top_level_keys!(keys) do
    allowed = @contexts

    case Enum.all?(keys, &(&1 in allowed)) do
      true ->
        :ok

      false ->
        raise(ArgumentError, "invalid passport rules shape, expected configured context maps")
    end
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
