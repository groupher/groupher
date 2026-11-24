defmodule GroupherServer.CMS.Review.Commands.Recheck do
  @moduledoc """
  Starts a fresh AI check for the current public content in one review scope.

      reviewer command
        -> lock current public target
        -> read current public content and policy
        -> register a recheck request through CMS Review
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  import Ecto.Query

  alias GroupherServer.{CMS, Repo, ReviewBot}
  alias CMS.Passport.Authorization
  alias CMS.Review.{RequestSubmission, Target}
  alias CMS.Command.ConfirmationDefinition

  alias CMS.Model.{
    ArticleBinding,
    ArticlePublic,
    ArticleSnapshot,
    ArticleLifecycle,
    CommentBody,
    CommentLifecycle
  }

  @pipeline operation: :cms_review_recheck,
            access: :user,
            target: :target_key,
            params: [:scope_key],
            confirmation: __MODULE__.Confirmation

  defmodule Confirmation do
    @moduledoc """
    Receipt confirmation for a recheck registered against current public content.

        CMS Review recheck -> Receipt confirmation -> returned command result
    """
    use ConfirmationDefinition,
      operation: :cms_review_recheck,
      data_keys: ["target_type", "target_id", "request_count"],
      field_types: %{
        "target_type" => :string,
        "target_id" => :string,
        "request_count" => :integer
      }
  end

  def execute(target_key, scope_key, actor, command_id)
      when is_binary(target_key) and is_binary(scope_key) do
    execute_pipeline(target_key, scope_key, actor, command_id)
  end

  def execute(_target_key, _scope_key, _actor, _command_id) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  receipt_pipeline execute_pipeline(target_key, scope_key, actor, command_id) do
    prepare(fn -> prepare(target_key, scope_key) end)
    gate(fn prepared -> authorize(prepared, actor) end)
    change(fn prepared, operation_ref -> register(prepared, operation_ref) end)
    confirm(fn confirmation -> {:ok, confirmation} end)
    present(fn confirmation -> present_result(confirmation, command_id) end)
  end

  defp prepare(target_key, scope_key) do
    with {:ok, _community_id} <- parse_scope(scope_key) do
      target_type = target_key |> String.split(":") |> hd()

      if target_type in ["article", "comment"] do
        {:ok, %{target_key: target_key, scope_key: scope_key, target_type: target_type},
         target: {:cms_review_target, target_key}, params: %{scope_key: scope_key}}
      else
        {:error, CMS.ErrorCat.invalid_review_block()}
      end
    end
  end

  defp authorize(%{scope_key: "platform"} = prepared, actor) do
    with {:ok, :pass} <- authorize_permission(actor, "review.platform.decide") do
      {:ok, prepared}
    end
  end

  defp authorize(%{scope_key: "community:" <> community_id} = prepared, actor) do
    with {id, ""} <- Integer.parse(community_id),
         {:ok, %CMS.Model.Community{slug: slug}} <- GroupherServer.FrontDesk.community(id),
         {:ok, :pass} <- authorize_permission(actor, "review.decide", %{community: slug}) do
      {:ok, prepared}
    else
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp authorize(_prepared, _actor), do: {:error, CMS.ErrorCat.invalid_review_block()}

  defp authorize_permission(actor, permission, params \\ %{}) do
    case Authorization.check(actor, permission, params) do
      {:ok, true} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp register(
         %{target_key: target_key, scope_key: scope_key, target_type: target_type},
         operation_ref
       ) do
    with {:ok, context} <- Target.load_for_update(target_key, scope_key),
         {:ok, content} <- current_content(context),
         {:ok, configs} <- current_configs(context, scope_key),
         {:ok, requested_scope} <- request_scope(scope_key),
         target <- Map.put(request_target(context), :operation_ref, operation_ref),
         {:ok, requests} <-
           RequestSubmission.register_in_transaction(
             target,
             content,
             configs,
             :recheck,
             requested_scope
           ) do
      {:ok,
       %Confirmation{
         data: %{
           "target_type" => target_type,
           "target_id" => request_target_id(context),
           "request_count" => length(requests)
         }
       }}
    end
  end

  defp current_content(%{
         type: :article,
         target: article,
         lifecycle: %ArticleLifecycle{state: state}
       })
       when state in [:published, :archived] do
    with %ArticlePublic{snapshot_id: snapshot_id} = public <-
           Repo.get_by(ArticlePublic, article_id: article.id),
         %ArticleSnapshot{} = snapshot <- Repo.get(ArticleSnapshot, snapshot_id) do
      {:ok,
       %{
         title: public.title || snapshot.title || "",
         body: CMS.Articles.Body.document(snapshot).plain_text || "",
         images: CMS.Review.Media.article_snapshot_images(snapshot.id)
       }}
    else
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp current_content(%{
         type: :comment,
         target: comment,
         parent: article,
         lifecycle: %CommentLifecycle{state: :visible},
         scope_key: scope_key
       }) do
    with %CommentBody{} = body <- Repo.get_by(CommentBody, comment_id: comment.id),
         {:ok, title} <- comment_parent_title(article, comment) do
      {:ok,
       %{
         title: title,
         body: body.plain_text || "",
         images:
           CMS.Review.Media.comment_images(
             body.json,
             comment_image_communities(scope_key, article.id)
           )
       }}
    else
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp comment_parent_title(%{thread: :doc, id: article_id}, _comment) do
    with %ArticlePublic{title: title} <- Repo.get(ArticlePublic, article_id) do
      {:ok, title || ""}
    else
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp comment_parent_title(%{id: article_id}, _comment) do
    case Repo.get_by(ArticlePublic, article_id: article_id) do
      %ArticlePublic{title: title} -> {:ok, title || ""}
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp scope_community_id("community:" <> value) do
    case Integer.parse(value) do
      {id, ""} when id > 0 -> id
      _ -> nil
    end
  end

  defp scope_community_id(_scope_key), do: nil

  defp comment_image_communities(scope_key, article_id) do
    case scope_community_id(scope_key) do
      nil ->
        Repo.all(
          from(binding in ArticleBinding,
            where: binding.article_id == ^article_id,
            select: binding.community_id
          )
        )

      id ->
        [id]
    end
  end

  defp current_configs(%{type: :article}, scope_key) do
    with {:ok, community_id} <- parse_scope(scope_key) do
      if community_id do
        ReviewBot.configs_for_targets([community_id], :article)
      else
        ReviewBot.configs_for_targets([], :article)
      end
    end
  end

  defp current_configs(%{type: :comment}, scope_key) do
    with {:ok, community_id} <- parse_scope(scope_key) do
      ReviewBot.configs(community_id, :comment)
    end
  end

  defp request_scope("platform"), do: {:ok, :system}

  defp request_scope("community:" <> id) do
    case Integer.parse(id) do
      {community_id, ""} when community_id > 0 -> {:ok, {:community, community_id}}
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp request_scope(_scope_key), do: {:error, CMS.ErrorCat.invalid_review_block()}

  defp request_target(%{
         type: :article,
         target: article,
         lifecycle: %ArticleLifecycle{} = lifecycle
       }) do
    %{type: :article, article_id: article.id, lifecycle: lifecycle}
  end

  defp request_target(%{
         type: :comment,
         target: comment,
         lifecycle: %CommentLifecycle{} = lifecycle
       }) do
    %{type: :comment, comment_id: comment.id, lifecycle: lifecycle}
  end

  defp request_target_id(%{type: :article, target: article}), do: article.id
  defp request_target_id(%{type: :comment, target: comment}), do: to_string(comment.id)

  defp parse_scope("platform"), do: {:ok, nil}

  defp parse_scope("community:" <> id) do
    case Integer.parse(id) do
      {community_id, ""} when community_id > 0 -> {:ok, community_id}
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp parse_scope(_scope_key), do: {:error, CMS.ErrorCat.invalid_review_block()}

  defp present_result(%Confirmation{data: data}, command_id) do
    {:ok,
     %{
       command_id: command_id,
       target_type: target_type(data["target_type"]),
       target_id: data["target_id"],
       action: :recheck,
       request_count: data["request_count"]
     }}
  end

  defp present_result(_confirmation, _command_id) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  defp target_type("article"), do: :article
  defp target_type("comment"), do: :comment
end
