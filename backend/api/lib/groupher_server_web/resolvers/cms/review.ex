defmodule GroupherServerWeb.Resolvers.CMS.Review do
  @moduledoc """
  Authorized CMS review queue and current opinion reads.

  Business position:

      GraphQL CMS review field
        -> resolver authorizes reviewer scope
          -> CMS queue read or decision command
  """

  alias GroupherServer.CMS
  alias GroupherServer.{CMS, FrontDesk}
  alias CMS.Model.Community

  def pending_content_reviews(_parent, %{scope: scope}, %{context: %{cur_user: actor}}) do
    with {:ok, normalized, attrs, permission, params} <- resolve_scope(scope),
         {:ok, :pass} <- authorize(actor, permission, params),
         {:ok, requests} <- CMS.pending_artiment_reviews(attrs) do
      {:ok, Enum.map(requests, &present(&1, normalized))}
    end
  end

  def pending_content_reviews(_parent, _args, _resolution) do
    {:error, CMS.passport_error_cat_permission_denied()}
  end

  def content_review(_parent, %{target: target}, %{context: %{cur_user: actor}}) do
    with {:ok, attrs} <- resolve_target(target, actor),
         {:ok, scope, permission, params} <- target_scope(attrs),
         {:ok, :pass} <- authorize(actor, permission, params),
         {:ok, request} <- CMS.current_review_for_scope(attrs) do
      {:ok, if(request, do: present(request, scope), else: nil)}
    end
  end

  def content_review(_parent, _args, _resolution) do
    {:error, CMS.passport_error_cat_permission_denied()}
  end

  def decide_content(_parent, %{target: target, command_id: command_id}, %{
        context: %{cur_user: actor},
        definition: %{name: field_name}
      }) do
    with {:ok, target_key, scope_key, target_type, target_id} <-
           decision_target(field_name, target),
         {:ok, _result} <-
           CMS.decide_review_target(target_key, scope_key, action(field_name), actor, command_id) do
      {:ok,
       %{
         command_id: command_id,
         target_type: target_type,
         target_id: target_id,
         action: Atom.to_string(action(field_name))
       }}
    end
  end

  def decide_content(_parent, _args, _resolution) do
    {:error, CMS.passport_error_cat_permission_denied()}
  end

  def recheck_content(
        _parent,
        %{target: target, scope: scope, command_id: command_id},
        %{context: %{cur_user: actor}}
      ) do
    with {:ok, attrs} <- resolve_target(target, actor),
         {:ok, target_key, target_type, target_id} <- recheck_target(attrs),
         {:ok, scope_key} <- recheck_scope(scope, attrs),
         {:ok, _result} <- CMS.recheck_review_target(target_key, scope_key, actor, command_id) do
      {:ok,
       %{
         command_id: command_id,
         target_type: target_type,
         target_id: target_id,
         action: "recheck"
       }}
    end
  end

  def recheck_content(_parent, _args, _resolution) do
    {:error, CMS.passport_error_cat_permission_denied()}
  end

  defp recheck_target(%{type: :article, article_id: id}) when is_binary(id),
    do: {:ok, "article:#{id}", :article, id}

  defp recheck_target(%{type: :comment, comment_id: id}) when is_integer(id),
    do: {:ok, "comment:#{id}", :comment, to_string(id)}

  defp recheck_target(%{type: :doc, article_id: id, branch_id: branch_id})
       when is_binary(id) and is_integer(branch_id),
       do: {:ok, "doc:#{id}:#{branch_id}", :doc, "#{id}:#{branch_id}"}

  defp recheck_target(_attrs), do: {:error, CMS.invalid_review_block_error()}

  defp recheck_scope(%{type: :platform}, %{type: :doc}), do: {:ok, "platform"}
  defp recheck_scope(%{type: :platform}, _attrs), do: {:ok, "platform"}

  defp recheck_scope(%{type: :community, community: slug}, attrs) when is_binary(slug) do
    with {:ok, %{id: id}} <- FrontDesk.community(slug, mode: :internal),
         true <- is_nil(Map.get(attrs, :community_id)) or Map.get(attrs, :community_id) == id do
      {:ok, "community:#{id}"}
    else
      _ -> {:error, CMS.invalid_review_block_error()}
    end
  end

  defp recheck_scope(_scope, _attrs), do: {:error, CMS.invalid_review_block_error()}

  defp resolve_scope(%{type: :platform}) do
    {:ok, %{type: :platform}, %{type: :article, article_id: nil, community_id: nil},
     "review.platform.read", %{}}
  end

  defp resolve_scope(%{type: :community, community: slug}) when is_binary(slug) do
    with {:ok, %Community{} = community} <- FrontDesk.community(slug, mode: :internal) do
      {:ok, %{type: :community, community: community},
       %{type: :article, article_id: nil, community_id: community.id}, "review.read",
       %{community: slug}}
    end
  end

  defp resolve_scope(_scope), do: {:error, CMS.passport_error_cat_permission_denied()}

  defp resolve_target(%{type: :article, article: path}, actor) when is_map(path) do
    with {:ok, projection} <- FrontDesk.article(path, actor),
         id when is_binary(id) <- Map.get(projection, :id),
         {:ok, community} <- FrontDesk.community(path.community, actor, []) do
      {:ok, %{type: :article, article_id: id, community_id: community.id}}
    end
  end

  defp resolve_target(%{type: :article, article_id: id} = input, _actor) when is_binary(id) do
    with {:ok, article} <- FrontDesk.article(id, mode: :internal, view: :command_context),
         {:ok, scope, _permission, _params} <-
           target_scope(%{type: :article, article_id: id, community_id: input.community_id}) do
      {:ok, %{type: :article, article_id: article.id, community_id: scope_community_id(scope)}}
    end
  end

  defp resolve_target(%{type: :comment, comment: path}, actor) when is_map(path) do
    case FrontDesk.comment(path, actor) do
      {:ok, comment} ->
        {:ok, %{type: :comment, comment_id: comment.id, community_id: comment.community_id}}

      {:error, _reason} = error ->
        error
    end
  end

  defp resolve_target(%{type: :comment, comment_id: id}, _actor) when is_binary(id) do
    case FrontDesk.comment(id, mode: :internal, view: :with_author) do
      {:ok, comment} ->
        {:ok, %{type: :comment, comment_id: comment.id, community_id: comment.community_id}}

      {:error, _reason} = error ->
        error
    end
  end

  defp resolve_target(%{type: :doc, article: path, branch_id: requested_branch}, actor)
       when is_map(path) do
    with {:ok, projection} <- FrontDesk.article(path, actor),
         id when is_binary(id) <- Map.get(projection, :id),
         branch_id when is_integer(branch_id) <- Map.get(projection, :branch_id),
         true <- is_nil(requested_branch) or requested_branch == branch_id do
      {:ok, %{type: :doc, article_id: id, branch_id: branch_id, community_id: nil}}
    else
      _ -> {:error, CMS.passport_error_cat_permission_denied()}
    end
  end

  defp resolve_target(%{type: :doc, article_id: id, branch_id: branch_id}, _actor)
       when is_binary(id) and is_integer(branch_id) do
    case FrontDesk.article(id, mode: :internal, view: :command_context) do
      {:ok, article} ->
        {:ok, %{type: :doc, article_id: article.id, branch_id: branch_id, community_id: nil}}

      {:error, _reason} = error ->
        error
    end
  end

  defp resolve_target(_target, _actor), do: {:error, CMS.passport_error_cat_permission_denied()}

  defp target_scope(%{community_id: nil}) do
    {:ok, %{type: :platform}, "review.platform.read", %{}}
  end

  defp target_scope(%{community_id: community_id}) do
    with {:ok, %{slug: slug}} <- FrontDesk.community(community_id) do
      {:ok, %{type: :community, community: slug}, "review.read", %{community: slug}}
    end
  end

  defp target_scope(_attrs), do: {:ok, %{type: :platform}, "review.platform.read", %{}}

  defp decision_target(field_name, %{type: :article, article_id: id, community_id: community_id}) do
    expected_type =
      field_name |> Atom.to_string() |> String.split("_") |> List.last() |> String.to_atom()

    if expected_type == :article and is_binary(id) do
      scope_key = if is_nil(community_id), do: "platform", else: "community:#{community_id}"
      {:ok, "article:#{id}", scope_key, :article, id}
    else
      {:error, CMS.invalid_review_block_error()}
    end
  end

  defp decision_target(
         field_name,
         %{type: :comment, comment_id: id, community_id: community_id}
       )
       when is_binary(id) do
    expected_type =
      field_name |> Atom.to_string() |> String.split("_") |> List.last() |> String.to_atom()

    if expected_type == :comment do
      scope_key = if is_nil(community_id), do: "platform", else: "community:#{community_id}"
      {:ok, "comment:#{id}", scope_key, :comment, id}
    else
      {:error, CMS.invalid_review_block_error()}
    end
  end

  defp decision_target(
         field_name,
         %{type: :doc, article_id: id, branch_id: branch_id}
       )
       when is_binary(id) and is_integer(branch_id) do
    expected_type =
      field_name |> Atom.to_string() |> String.split("_") |> List.last() |> String.to_atom()

    if expected_type == :doc do
      {:ok, "doc:#{id}:#{branch_id}", "platform", :doc, "#{id}:#{branch_id}"}
    else
      {:error, CMS.invalid_review_block_error()}
    end
  end

  defp decision_target(_field_name, _target) do
    {:error, CMS.invalid_review_block_error()}
  end

  defp action(field_name) do
    field_name |> Atom.to_string() |> String.split("_") |> hd() |> String.to_atom()
  end

  defp authorize(actor, permission, params) do
    case CMS.passport_authorization_check(actor, permission, params) do
      {:ok, true} -> {:ok, :pass}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.passport_error_cat_permission_denied()}
    end
  end

  defp present(request, _scope) do
    opinion = present_opinion(request.result)

    %{
      artiment_review_id: request.id,
      target_type: request.target_type,
      article_id: request.article_id,
      comment_id: request.comment_id,
      branch_id: request.branch_id,
      community_id: request.community_id,
      state: request.state,
      review_mode: get_in(request.policy_snapshot, ["review_mode"]),
      system_opinion: if(is_nil(request.community_id), do: opinion),
      community_opinion: if(not is_nil(request.community_id), do: opinion)
    }
  end

  defp scope_community_id(%{type: :community, community: community}), do: community.id
  defp scope_community_id(_scope), do: nil

  defp present_opinion(nil), do: nil

  defp present_opinion(opinion) do
    %{
      status: Map.get(opinion, "status"),
      summary: Map.get(opinion, "summary"),
      sus_notes:
        Enum.map(Map.get(opinion, "sus_notes", []), fn note ->
          %{
            type: Map.get(note, "type"),
            evidence: Map.get(note, "evidence"),
            explanation: Map.get(note, "explanation")
          }
        end)
    }
  end
end
