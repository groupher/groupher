defmodule GroupherServer.CMS.DocTree.Publish.ContentMerge do
  @moduledoc """
  Compares complete Doc content and selects whole fields in a three-way merge.

      source Snapshot + current source + target -> selected fields or conflicts

  The caller supplies locked, fully loaded content and persists the selected
  values and their asset references in its own transaction. This module does
  not read or write a WorkingCopy.
  """

  @fields ~w(title digest slug subtitle link_addr template_key cover_url cover_url_dark body tags cover_edit asset_refs)a
  @cover_fields ~w(format_version canvas_width canvas_height light dark)a
  @asset_fields ~w(asset_id usage position block_id block_type alt title source meta)a
  @body_fields ~w(json schema_version markdown html markdown_toc plain_text thumbnail xml rss)a

  @doc "Selects source or target for every field, or returns all unresolved conflicts."
  def merge(base, source, target, opts \\ [])

  def merge(base, source, target, opts) when is_map(base) and is_map(source) and is_map(target) do
    choices = Keyword.get(opts, :choices, %{})
    mode = Keyword.get(opts, :mode, :merge)

    with true <- mode in [:merge, :fast_forward],
         true <- is_map(choices),
         {:ok, base_keys} <- comparable(base),
         {:ok, source_keys} <- comparable(source),
         {:ok, target_keys} <- comparable(target) do
      resolve(base_keys, source_keys, target_keys, source, target, choices, mode)
    else
      false -> {:error, :invalid_merge_options}
      {:error, _reason} = error -> error
    end
  end

  def merge(_base, _source, _target, _opts), do: {:error, :invalid_doc_content}

  @doc "Returns fields changed in Q from its source and not already present in D."
  def exclusive_changes(base, queue, default)
      when is_map(base) and is_map(queue) and is_map(default) do
    with {:ok, base_keys} <- comparable(base),
         {:ok, queue_keys} <- comparable(queue),
         {:ok, default_keys} <- comparable(default) do
      {:ok,
       Enum.filter(@fields, fn field ->
         queue_keys[field] != base_keys[field] and queue_keys[field] != default_keys[field]
       end)}
    end
  end

  def exclusive_changes(_base, _queue, _default), do: {:error, :invalid_doc_content}

  defp comparable(content) do
    with true <- Enum.all?([:cover_refs | @fields], &Map.has_key?(content, &1)),
         {:ok, body} <- body_key(content.body),
         {:ok, tags} <- tags_key(content.tags),
         {:ok, cover} <- cover_key(content.cover_edit),
         {:ok, assets} <- asset_key(content.asset_refs, [:attachment]),
         {:ok, cover_refs} <- cover_refs_key(content.cover_refs) do
      {:ok,
       content
       |> Map.take(@fields)
       |> Map.put(:body, body)
       |> Map.put(:tags, tags)
       |> Map.put(:cover_edit, cover)
       |> Map.put(:asset_refs, assets)
       |> Map.put(:cover_url, {content.cover_url, cover_refs.cover})
       |> Map.put(:cover_url_dark, {content.cover_url_dark, cover_refs.cover_dark})}
    else
      false -> {:error, :invalid_doc_content}
      {:error, _reason} = error -> error
    end
  end

  defp body_key(%{json: json, schema_version: version} = body)
       when is_binary(json) and is_integer(version) and version > 0 do
    with true <- Enum.all?(@body_fields, &Map.has_key?(body, &1)),
         {:ok, document} when is_list(document) <- RFC8785.decode(json),
         {:ok, canonical} <- RFC8785.encode(document) do
      {:ok, {version, canonical}}
    else
      _ -> {:error, :invalid_body_document}
    end
  end

  defp body_key(_body), do: {:error, :invalid_body_document}

  defp tags_key(tags) when is_list(tags) do
    if Enum.all?(tags, &is_integer/1) do
      case tags |> Enum.uniq() |> Enum.sort() |> RFC8785.encode() do
        {:ok, canonical} -> {:ok, canonical}
        {:error, _} -> {:error, :invalid_doc_tags}
      end
    else
      {:error, :invalid_doc_tags}
    end
  end

  defp tags_key(_tags), do: {:error, :invalid_doc_tags}

  defp cover_key(nil), do: {:ok, nil}

  defp cover_key(cover) when is_map(cover) do
    with true <- Enum.all?(@cover_fields, &Map.has_key?(cover, &1)),
         {:ok, canonical} <- RFC8785.encode(Map.take(cover, @cover_fields)) do
      {:ok, canonical}
    else
      _ -> {:error, :invalid_cover_edit}
    end
  end

  defp cover_key(_cover), do: {:error, :invalid_cover_edit}

  defp asset_key(refs, allowed_usages) when is_list(refs) do
    if Enum.all?(refs, fn ref ->
         is_map(ref) and Map.get(ref, :usage) in allowed_usages and
           Enum.all?(@asset_fields, &Map.has_key?(ref, &1))
       end) do
      refs
      |> Enum.reduce_while({:ok, []}, fn ref, {:ok, acc} ->
        case RFC8785.encode(Map.take(ref, @asset_fields)) do
          {:ok, canonical} -> {:cont, {:ok, [canonical | acc]}}
          {:error, _} -> {:halt, {:error, :invalid_asset_refs}}
        end
      end)
      |> case do
        {:ok, canonical} -> {:ok, Enum.sort(canonical)}
        error -> error
      end
    else
      {:error, :invalid_asset_refs}
    end
  end

  defp asset_key(_refs, _allowed_usages), do: {:error, :invalid_asset_refs}

  defp cover_refs_key(refs) when is_list(refs) do
    light = Enum.filter(refs, &(is_map(&1) and Map.get(&1, :usage) == :cover))
    dark = Enum.filter(refs, &(is_map(&1) and Map.get(&1, :usage) == :cover_dark))

    with true <- length(light) + length(dark) == length(refs),
         true <- length(light) <= 1 and length(dark) <= 1,
         {:ok, light_key} <- asset_key(light, [:cover]),
         {:ok, dark_key} <- asset_key(dark, [:cover_dark]) do
      {:ok, %{cover: light_key, cover_dark: dark_key}}
    else
      _ -> {:error, :invalid_asset_refs}
    end
  end

  defp cover_refs_key(_refs), do: {:error, :invalid_asset_refs}

  defp resolve(base, source, target, source_content, target_content, choices, mode) do
    conflicts =
      Enum.filter(@fields, fn field ->
        source[field] != base[field] and target[field] != base[field] and
          source[field] != target[field]
      end)

    invalid_choices =
      Enum.any?(choices, fn {field, side} ->
        field not in conflicts or side not in [:source, :target]
      end)

    unresolved = Enum.reject(conflicts, &Map.has_key?(choices, &1))

    cond do
      mode == :fast_forward and target != base ->
        {:error, :invalid_fast_forward}

      invalid_choices ->
        {:error, :invalid_conflict_choice}

      unresolved != [] ->
        {:error, {:merge_conflict, unresolved}}

      true ->
        origins =
          Map.new(@fields, fn field ->
            side =
              cond do
                Map.has_key?(choices, field) -> choices[field]
                mode == :fast_forward and target[field] == base[field] -> :source
                source[field] == target[field] -> :target
                target[field] == base[field] -> :source
                true -> :target
              end

            {field, side}
          end)

        fields =
          Map.new(origins, fn {field, side} ->
            content = if side == :source, do: source_content, else: target_content
            {field, Map.fetch!(content, field)}
          end)
          |> Map.put(:cover_refs, selected_cover_refs(origins, source_content, target_content))

        {:ok, %{fields: fields, origins: origins}}
    end
  end

  defp selected_cover_refs(origins, source, target) do
    Enum.flat_map([{:cover_url, :cover}, {:cover_url_dark, :cover_dark}], fn {field, usage} ->
      content = if origins[field] == :source, do: source, else: target
      Enum.filter(content.cover_refs, &(&1.usage == usage))
    end)
  end
end
