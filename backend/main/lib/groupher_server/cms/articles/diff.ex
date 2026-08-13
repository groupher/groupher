defmodule GroupherServer.CMS.Articles.Diff do
  @moduledoc """
  Computes transient differences between immutable Article revisions.

      left Snapshot/current state
                  |
                  | canonical hash differs
                  v
      common fields + product data + document source comparison

  Diff stores nothing. TimeMachine asks for only the selected revision pair, so
  Snapshot storage remains linear rather than growing with every possible pair.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Diff
        -> Repo / domain event
  """

  alias GroupherServer.CMS.Articles.Snapshot
  alias GroupherServer.CMS.Model.ArticleSnapshot
  alias Helper.T

  @common_fields [:title, :digest, :slug, :subtitle]

  @type result :: %{
          changed: boolean(),
          document_changed: boolean(),
          fields: map(),
          data: map()
        }

  @doc "Returns whether two Snapshots contain exactly the same versioned state."
  @spec equal?(map(), map()) :: boolean()
  def equal?(%{version_hash: _} = left, %{version_hash: _} = right) do
    left.version_hash == right.version_hash
  end

  @doc """
  Compares two immutable Article Snapshots.

  The editor AST renderer may consume `document_changed` and calculate its own
  structural/text presentation lazily. This function deliberately returns no
  persisted or pairwise cache record.
  """
  @spec compare(ArticleSnapshot.t(), ArticleSnapshot.t()) :: result()
  def compare(%ArticleSnapshot{} = left, %ArticleSnapshot{} = right) do
    compare_states(snapshot_state(left), snapshot_state(right))
  end

  @doc "Compares a mutable current Article row with an immutable Snapshot without storing Diff state."
  @spec compare_current(T.article(), ArticleSnapshot.t()) :: T.domain_res(result())
  def compare_current(article, %ArticleSnapshot{} = snapshot) do
    with {:ok, current_state} <- Snapshot.current_state(article) do
      {:ok, compare_states(current_state, snapshot_state(snapshot))}
    end
  end

  defp compare_states(left, right) do
    if equal?(left, right) do
      %{changed: false, document_changed: false, fields: %{}, data: %{}}
    else
      fields = changed_values(left, right, @common_fields)
      data = changed_map(left.data || %{}, right.data || %{})
      document_changed = left.document_json != right.document_json

      %{
        changed: map_size(fields) > 0 or map_size(data) > 0 or document_changed,
        document_changed: document_changed,
        fields: fields,
        data: data
      }
    end
  end

  defp snapshot_state(snapshot) do
    %{
      version_hash: snapshot.version_hash,
      title: snapshot.title,
      digest: snapshot.digest,
      slug: snapshot.slug,
      subtitle: snapshot.subtitle,
      document_json: snapshot.document_json,
      data: snapshot.data || %{}
    }
  end

  defp changed_values(left, right, fields) do
    Enum.reduce(fields, %{}, fn field, acc ->
      put_change(acc, field, Map.get(left, field), Map.get(right, field))
    end)
  end

  defp changed_map(left, right) do
    left
    |> Map.keys()
    |> Enum.concat(Map.keys(right))
    |> Enum.uniq()
    |> Enum.reduce(%{}, fn field, acc ->
      put_change(acc, field, Map.get(left, field), Map.get(right, field))
    end)
  end

  defp put_change(acc, _field, value, value), do: acc

  defp put_change(acc, field, before, after_value) do
    Map.put(acc, field, %{before: before, after: after_value})
  end
end
