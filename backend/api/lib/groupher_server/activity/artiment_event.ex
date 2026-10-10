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
      alias GroupherServer.Activity
      alias Activity.Event
      alias GroupherServer.CMS

      alias CMS.Model.Comment

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
           @stream_field => comment.article_id,
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

          with {:ok, community_id} <- resource_community_id(resource) do
            {:ok,
             %{
               @stream_field => stable_article_id(resource),
               community_id: community_id,
               stream_snapshot: Event.snapshot(resource, [:title, :thread]),
               subject_type: to_string(@thread),
               subject_ref: Event.stringify(stable_article_id(resource)),
               subject_snapshot: Event.snapshot(resource, [:title, :inner_id]),
               target_type: target_type(target),
               target_ref: target_ref(target),
               target_snapshot: target_snapshot(target),
               branch_id: branch_id(resource)
             }
             |> Map.take(@schema.__schema__(:fields))}
          end
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

      defp stable_article_id(%{article_id: article_id}) when is_binary(article_id),
        do: article_id

      defp stable_article_id(%{id: article_id}) when is_binary(article_id), do: article_id

      defp resource_community_id(resource) do
        case Map.get(resource, :community_id) do
          community_id when is_integer(community_id) ->
            {:ok, community_id}

          _ ->
            case CMS.Articles.Bindings.get(resource, Map.get(resource, :community)) do
              {:ok, %{community: %{id: community_id}}} -> {:ok, community_id}
              {:error, reason} -> {:error, Event.error(inspect(reason))}
            end
        end
      end

      defp branch_id(%{branch_id: branch_id}) when is_integer(branch_id), do: branch_id

      defp branch_id(_), do: nil
    end
  end
end
