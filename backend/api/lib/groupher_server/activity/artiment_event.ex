defmodule GroupherServer.Activity.ArtimentEvent do
  @moduledoc """
  Defines the shared contract implemented by Article Activity handlers.

      thread handler -> shared descriptor logic -> Activity Event
  """

  defmacro __using__(opts) do
    thread = Keyword.fetch!(opts, :thread)
    schema = Keyword.fetch!(opts, :schema)
    stream_field = Keyword.fetch!(opts, :stream_field)

    quote bind_quoted: [thread: thread, schema: schema, stream_field: stream_field] do
      alias GroupherServer.Activity.Event
      alias GroupherServer.CMS.Model.Comment

      @thread thread
      @schema schema
      @stream_field stream_field

      def schema, do: @schema
      def stream_field, do: @stream_field
      def resource_type, do: @thread
      def log(resource, action, opts), do: Event.log(__MODULE__, resource, action, opts)
      def project(log, surface), do: Event.project(__MODULE__, log, surface)
      def surface_actions(surface), do: Event.surface_actions(__MODULE__, surface)

      def describe(%Comment{thread: @thread} = comment, _action, _opts) do
        {:ok,
         %{
           @stream_field => Event.stringify(comment.article_hash_id),
           community_id: comment.community_id,
           stream_snapshot: %{},
           subject_type: "comment",
           subject_ref: Event.stringify(comment.inner_id || comment.id),
           subject_snapshot: Event.snapshot(comment, [:inner_id]),
           target_type: nil,
           target_ref: nil,
           target_snapshot: %{}
         }}
      end

      def describe(resource, action, opts) when is_map(resource) do
        resource_thread = Map.get(resource, :thread) || get_in(resource, [:meta, :thread])

        if resource_thread == @thread do
          target = Keyword.get(opts, :target)

          {:ok,
           %{
             @stream_field => Event.stringify(Map.fetch!(resource, :article_hash_id)),
             community_id: Map.fetch!(resource, :community_id),
             stream_snapshot: Event.snapshot(resource, [:title, :thread]),
             subject_type: to_string(@thread),
             subject_ref: Event.stringify(Map.fetch!(resource, :article_hash_id)),
             subject_snapshot: Event.snapshot(resource, [:title, :inner_id]),
             target_type: target_type(target),
             target_ref: target_ref(target),
             target_snapshot: target_snapshot(target),
             branch_ref: branch_ref(resource)
           }
           |> Map.take(@schema.__schema__(:fields))}
        else
          {:error, Event.error("Activity resource thread does not match handler")}
        end
      rescue
        KeyError -> {:error, Event.error("invalid Activity Article resource")}
      end

      def describe(_, _, _), do: {:error, Event.error("invalid Activity Article resource")}

      defp target_type(nil), do: nil
      defp target_type(%Comment{}), do: "comment"
      defp target_type(%{activity_type: type}), do: to_string(type)
      defp target_type(_), do: "unknown"

      defp target_ref(nil), do: nil
      defp target_ref(%Comment{} = comment), do: Event.stringify(comment.inner_id || comment.id)
      defp target_ref(%{ref: ref}), do: Event.stringify(ref)
      defp target_ref(_), do: nil

      defp target_snapshot(nil), do: %{}
      defp target_snapshot(target), do: Event.snapshot(target, [:title, :inner_id])

      defp branch_ref(%{branch_id: branch_id}) when not is_nil(branch_id),
        do: Event.stringify(branch_id)

      defp branch_ref(_), do: nil
    end
  end
end
