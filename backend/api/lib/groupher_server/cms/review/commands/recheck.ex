defmodule GroupherServer.CMS.Review.Commands.Recheck do
  @moduledoc """
  Starts a fresh AI check for the current public content in one review scope.

      moderator command
        -> lock current public target
        -> read current public content and policy
        -> register a recheck request through CMS Review
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{CMS, Repo, ReviewBot}
  alias CMS.Passport.Authorization
  alias CMS.Review.{RequestSubmission, Target}
  alias CMS.Command.ConfirmationDefinition

  alias CMS.Model.{
    ArticleBodySnapshot,
    ArticlePublic,
    ArticleRevision,
    ArticleLifecycle,
    CommentBody,
    CommentLifecycle,
    DocBranchVersion,
    DocLifecycle,
    DocPublic
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
    change(fn prepared -> register(prepared) end)
    confirm(fn confirmation -> {:ok, confirmation} end)
    present(fn confirmation -> present_result(confirmation, command_id) end)
  end

  defp prepare(target_key, scope_key) do
    with {:ok, _community_id} <- parse_scope(scope_key) do
      target_type = target_key |> String.split(":") |> hd()

      if target_type in ["article", "comment", "doc"] do
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

  defp register(%{target_key: target_key, scope_key: scope_key, target_type: target_type}) do
    with {:ok, context} <- Target.load_for_update(target_key, scope_key),
         {:ok, content} <- current_content(context),
         {:ok, configs} <- current_configs(context, scope_key),
         target <- request_target(context),
         {:ok, requests} <-
           RequestSubmission.register_in_transaction(target, content, configs, :recheck) do
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
         kind: :article,
         target: article,
         lifecycle: %ArticleLifecycle{state: state}
       })
       when state in [:published, :archived] do
    with %ArticlePublic{revision_id: revision_id} = public <-
           Repo.get_by(ArticlePublic, article_id: article.id),
         %ArticleRevision{body_snapshot_id: body_id} = revision <-
           Repo.get(ArticleRevision, revision_id),
         %ArticleBodySnapshot{} = body <- Repo.get(ArticleBodySnapshot, body_id) do
      {:ok,
       %{
         title: public.title || revision.title || "",
         body: body.plain_text || "",
         images: CMS.Review.Media.article_images(revision.id)
       }}
    else
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp current_content(%{
         kind: :comment,
         target: comment,
         parent: article,
         lifecycle: %CommentLifecycle{state: :visible}
       }) do
    with %CommentBody{} = body <- Repo.get_by(CommentBody, comment_id: comment.id),
         %ArticlePublic{} = public <- Repo.get_by(ArticlePublic, article_id: article.id) do
      {:ok,
       %{
         title: public.title || "",
         body: body.plain_text || "",
         images: CMS.Review.Media.comment_images(body.json, comment.community_id)
       }}
    else
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp current_content(%{
         kind: :doc,
         target: article,
         lifecycle: %DocLifecycle{state: state},
         case_attrs: %{branch_id: branch_id}
       })
       when state in [:published, :archived] do
    with %DocPublic{branch_version_id: version_id, title: title} <-
           Repo.get_by(DocPublic, article_id: article.id, branch_id: branch_id),
         %DocBranchVersion{revision_id: revision_id} <- Repo.get(DocBranchVersion, version_id),
         %ArticleRevision{body_snapshot_id: body_id} = revision <-
           Repo.get(ArticleRevision, revision_id),
         %ArticleBodySnapshot{} = body <- Repo.get(ArticleBodySnapshot, body_id) do
      {:ok,
       %{
         title: title || revision.title || "",
         body: body.plain_text || "",
         images: CMS.Review.Media.article_images(revision.id)
       }}
    else
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp current_configs(%{kind: :article}, scope_key) do
    with {:ok, community_id} <- parse_scope(scope_key) do
      if community_id do
        ReviewBot.configs_for_targets([community_id], :article)
      else
        ReviewBot.configs_for_targets([], :article)
      end
    end
  end

  defp current_configs(%{kind: :comment, target: comment}, _scope_key) do
    ReviewBot.configs(comment.community_id, :comment)
  end

  defp current_configs(%{kind: :doc}, _scope_key), do: ReviewBot.configs(nil, :doc)

  defp request_target(%{
         kind: :article,
         target: article,
         lifecycle: %ArticleLifecycle{} = lifecycle
       }) do
    %{type: :article, article_id: article.id, lifecycle: lifecycle}
  end

  defp request_target(%{
         kind: :comment,
         target: comment,
         lifecycle: %CommentLifecycle{} = lifecycle
       }) do
    %{type: :comment, comment_id: comment.id, lifecycle: lifecycle}
  end

  defp request_target(%{
         kind: :doc,
         target: article,
         lifecycle: %DocLifecycle{} = lifecycle,
         case_attrs: %{branch_id: branch_id}
       }) do
    %{type: :doc, article_id: article.id, branch_id: branch_id, lifecycle: lifecycle}
  end

  defp request_target_id(%{kind: :article, target: article}), do: article.id
  defp request_target_id(%{kind: :comment, target: comment}), do: to_string(comment.id)

  defp request_target_id(%{kind: :doc, target: article, case_attrs: %{branch_id: branch_id}}),
    do: "#{article.id}:#{branch_id}"

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
       action: "recheck",
       request_count: data["request_count"]
     }}
  end

  defp present_result(_confirmation, _command_id),
    do: {:error, CMS.ErrorCat.invalid_review_block()}

  defp target_type("article"), do: :article
  defp target_type("comment"), do: :comment
  defp target_type("doc"), do: :doc
end
