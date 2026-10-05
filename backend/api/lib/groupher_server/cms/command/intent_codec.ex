defmodule GroupherServer.CMS.Command.IntentCodec do
  @moduledoc """
  Encodes domain command params into the only persisted command identity.

  Every supported operation has an explicit storage policy. Values that may
  contain authored content are persisted only as bounded SHA-256 descriptors;
  only deliberately selected scalar identifiers and enum-like values remain
  readable for conflict diagnostics.

      domain command params
        -> operation policy
        -> canonical safe identity
        -> Command Receipt Store
  """

  alias GroupherServer.CMS.Command

  @type policy :: :digest | :digest_each | :empty | {:fields, %{String.t() => policy() | :raw}}

  @policies %{
    article_create: {:fields, %{"thread" => :raw, "attrs" => :digest_each}},
    article_update: :digest_each,
    article_publish: :digest_each,
    article_replace_asset: :digest_each,
    article_trash: :digest_each,
    article_restore: {:fields, %{"item_id" => :raw, "opts" => :digest_each}},
    article_permanently_delete: {:fields, %{"item_id" => :raw, "opts" => :digest_each}},
    collect_add: {:fields, %{"folder_id" => :raw}},
    collect_remove: {:fields, %{"folder_id" => :raw}},
    comment_create: :digest,
    comment_reply: :digest,
    comment_update: :digest,
    comment_delete: :empty,
    community_request_destroy: :digest_each,
    emotion_add: {:fields, %{"operation" => :raw, "emotion" => :raw}},
    emotion_remove: {:fields, %{"operation" => :raw, "emotion" => :raw}},
    upvote_add: {:fields, %{"operation" => :raw}},
    upvote_remove: {:fields, %{"operation" => :raw}},
    doc_publish_changes: :digest_each,
    doc_move_to_draft: {:fields, %{"id" => :raw, "opts" => :digest_each}},
    doc_move_subtree_to_draft: {:fields, %{"id" => :raw, "opts" => :digest_each}},
    doc_update_draft: {:fields, %{"id" => :raw, "opts" => :digest_each}},
    doc_tree_create_tab: {:fields, %{"target_id" => :raw, "args" => :digest_each}},
    doc_tree_create_group: {:fields, %{"target_id" => :raw, "args" => :digest_each}},
    doc_tree_create_page: {:fields, %{"target_id" => :raw, "args" => :digest_each}},
    doc_tree_create_link: {:fields, %{"target_id" => :raw, "args" => :digest_each}},
    doc_tree_create_pin: {:fields, %{"target_id" => :raw, "args" => :digest_each}},
    doc_tree_update_node: {:fields, %{"target_id" => :raw, "args" => :digest_each}},
    doc_tree_delete_node: {:fields, %{"target_id" => :raw, "args" => :digest_each}},
    doc_tree_duplicate_node: {:fields, %{"target_id" => :raw, "args" => :digest_each}},
    doc_tree_move_node: {:fields, %{"target_id" => :raw, "args" => :digest_each}},
    doc_tree_restore_trash_item: {:fields, %{"id" => :raw, "args" => :digest_each}}
  }

  @doc "Encodes params using the closed policy for one operation tag."
  @spec encode_tag(String.t(), term()) :: {:ok, map()} | {:error, :invalid_intent_params}
  def encode_tag(tag, params) when is_binary(tag) do
    case Command.operation_from_tag(tag) do
      {:ok, operation} -> encode(operation, params)
      _ -> {:error, :invalid_intent_params}
    end
  end

  @doc "Encodes params using the closed policy for one operation."
  @spec encode(atom(), term()) :: {:ok, map()} | {:error, :invalid_intent_params}
  def encode(operation, params) when is_atom(operation) do
    case Map.fetch(@policies, operation) do
      {:ok, policy} -> apply_policy(policy, params)
      :error -> {:error, :invalid_intent_params}
    end
  end

  defp apply_policy(:empty, params) when params in [nil, %{}, []], do: {:ok, %{}}
  defp apply_policy(:empty, _params), do: {:error, :invalid_intent_params}

  defp apply_policy(:digest, value) do
    with {:ok, canonical} <- canonical(value),
         {:ok, descriptor} <- digest(canonical) do
      {:ok, %{"$value" => descriptor}}
    end
  end

  defp apply_policy(:digest_each, value) do
    with {:ok, map} <- canonical_map_input(value) do
      reduce_fields(map, Map.new(map, fn {key, _value} -> {key, :digest} end))
    end
  end

  defp apply_policy({:fields, fields}, value) do
    with {:ok, map} <- canonical_map_input(value),
         true <- MapSet.equal?(MapSet.new(Map.keys(map)), MapSet.new(Map.keys(fields))) do
      reduce_fields(map, fields)
    else
      _ -> {:error, :invalid_intent_params}
    end
  end

  defp reduce_fields(map, fields) do
    Enum.reduce_while(fields, {:ok, %{}}, fn {key, policy}, {:ok, acc} ->
      case encode_field(policy, Map.fetch!(map, key)) do
        {:ok, encoded} -> {:cont, {:ok, Map.put(acc, key, encoded)}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp encode_field(:raw, value), do: canonical(value)
  defp encode_field(:digest, value), do: canonical(value) |> then(&digest_result/1)
  defp encode_field(:digest_each, value), do: apply_policy(:digest_each, value)
  defp encode_field({:fields, _fields} = policy, value), do: apply_policy(policy, value)

  defp digest_result({:ok, canonical}), do: digest(canonical)
  defp digest_result({:error, reason}), do: {:error, reason}

  defp digest(value) do
    with {:ok, encoded} <- Jason.encode(value),
         {:ok, stable_encoded} <- Jason.encode(stable_digest_term(value)) do
      {:ok,
       %{
         "__redacted__" => true,
         "sha256" => :crypto.hash(:sha256, stable_encoded) |> Base.encode16(case: :lower),
         "bytes" => byte_size(encoded)
       }}
    else
      {:error, _reason} ->
        {:error, :invalid_intent_params}
    end
  end

  defp stable_digest_term(value) when is_map(value) do
    [
      "$map",
      value
      |> Enum.sort_by(fn {key, _value} -> key end)
      |> Enum.map(fn {key, nested} -> [key, stable_digest_term(nested)] end)
    ]
  end

  defp stable_digest_term(value) when is_list(value) do
    ["$list", Enum.map(value, &stable_digest_term/1)]
  end

  defp stable_digest_term(value), do: ["$value", value]

  defp canonical_map_input(value) do
    with {:ok, canonical} <- canonical(value),
         true <- is_map(canonical) do
      {:ok, canonical}
    else
      _ -> {:error, :invalid_intent_params}
    end
  end

  defp canonical(value) when is_map(value) and not is_struct(value) do
    value
    |> Map.drop([:actor, :actor_id, :cur_user, :current_user])
    |> Enum.reduce_while({:ok, %{}}, fn {key, nested}, {:ok, acc} ->
      with {:ok, key} <- canonical_key(key),
           false <- Map.has_key?(acc, key),
           {:ok, nested} <- canonical(nested) do
        {:cont, {:ok, Map.put(acc, key, nested)}}
      else
        _ -> {:halt, {:error, :invalid_intent_params}}
      end
    end)
  end

  defp canonical(value) when is_list(value) do
    if Keyword.keyword?(value) do
      keys = Keyword.keys(value)

      if length(keys) == length(Enum.uniq(keys)) do
        value
        |> Keyword.drop([:actor, :actor_id, :cur_user, :current_user])
        |> Map.new()
        |> canonical()
      else
        {:error, :invalid_intent_params}
      end
    else
      Enum.reduce_while(value, {:ok, []}, fn nested, {:ok, acc} ->
        case canonical(nested) do
          {:ok, item} -> {:cont, {:ok, [item | acc]}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
      |> case do
        {:ok, items} -> {:ok, Enum.reverse(items)}
        error -> error
      end
    end
  end

  defp canonical(nil), do: {:ok, nil}
  defp canonical(%DateTime{} = value), do: {:ok, DateTime.to_iso8601(value)}
  defp canonical(%NaiveDateTime{} = value), do: {:ok, NaiveDateTime.to_iso8601(value)}
  defp canonical(%Date{} = value), do: {:ok, Date.to_iso8601(value)}

  defp canonical(value) when is_binary(value) or is_number(value) or is_boolean(value) do
    {:ok, value}
  end

  defp canonical(value) when is_atom(value), do: {:ok, Atom.to_string(value)}
  defp canonical(_value), do: {:error, :invalid_intent_params}

  defp canonical_key(key) when is_binary(key), do: {:ok, key}
  defp canonical_key(key) when is_atom(key), do: {:ok, Atom.to_string(key)}
  defp canonical_key(_key), do: {:error, :invalid_intent_params}
end
