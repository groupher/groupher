defmodule GroupherServer.CMS.Review.RequestSubmission do
  @moduledoc """
  Creates one CMS request per pinned system or community policy scope.

  Business position:

      CMS publish/edit command
        -> immutable content and policy snapshot
          -> scoped ArtimentReview rows
            -> review Effect
  """

  alias GroupherServer.ReviewBot
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.ArtimentReview
  alias ReviewBot.Model.ReviewBotConfig

  @doc "Creates scoped requests with immutable content and complete configuration snapshots."
  @spec register_in_transaction(map(), map(), map(), :publish | :edit | :recheck | :binding) ::
          {:ok, [ArtimentReview.t()]} | {:error, term()}
  def register_in_transaction(target, content, configs, trigger)
      when is_map(target) and is_map(content) and is_map(configs) and
             trigger in [:publish, :edit, :recheck, :binding] do
    register_in_transaction(target, content, configs, trigger, :all)
  end

  def register_in_transaction(_target, _content, _configs, _trigger) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  @doc "Creates one request for a specific policy scope inside the caller transaction."
  @spec register_in_transaction(
          map(),
          map(),
          map(),
          :publish | :edit | :recheck | :binding,
          :all | :system | {:community, pos_integer()}
        ) ::
          {:ok, [ArtimentReview.t()]} | {:error, term()}
  def register_in_transaction(target, content, configs, trigger, requested_scope)
      when is_map(target) and is_map(content) and is_map(configs) and
             trigger in [:publish, :edit, :recheck, :binding] and
             (requested_scope == :all or requested_scope == :system or
                (trigger == :recheck and is_tuple(requested_scope) and
                   tuple_size(requested_scope) == 2 and elem(requested_scope, 0) == :community and
                   is_integer(elem(requested_scope, 1)))) do
    with true <- Repo.in_transaction?(),
         {:ok, scopes} <- policy_scopes(configs, requested_scope),
         {:ok, attrs} <- target_attrs(target, content, trigger, scopes),
         {:ok, requests} <- insert_scoped_requests(attrs, target) do
      {:ok, requests}
    else
      false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  def register_in_transaction(_target, _content, _configs, _trigger, _scope) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  defp policy_scopes(configs, :all), do: all_policy_scopes(configs)

  defp policy_scopes(configs, requested_scope) do
    with {:ok, scopes} <- all_policy_scopes(configs) do
      case Enum.find(scopes, &(&1.scope == requested_scope)) do
        nil -> {:error, CMS.ErrorCat.invalid_review_block()}
        scope -> {:ok, [scope]}
      end
    end
  end

  defp all_policy_scopes(%{system: %ReviewBotConfig{} = system, community: nil}) do
    {:ok, [%{scope: :system, config: system, system_config: system}]}
  end

  defp all_policy_scopes(%{
         system: %ReviewBotConfig{} = system,
         community: %ReviewBotConfig{} = community
       }) do
    {:ok,
     [
       %{scope: :system, config: system, system_config: system},
       %{scope: {:community, community.community_id}, config: community, system_config: system}
     ]}
  end

  defp all_policy_scopes(%{system: %ReviewBotConfig{} = system, communities: communities})
       when is_map(communities) do
    scope_policies =
      communities
      |> Enum.sort_by(fn {community_id, _config} -> community_id end)
      |> Enum.map(fn {community_id, %ReviewBotConfig{} = config} ->
        %{scope: {:community, community_id}, config: config, system_config: system}
      end)

    {:ok, [%{scope: :system, config: system, system_config: system} | scope_policies]}
  end

  defp all_policy_scopes(_configs) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  defp target_attrs(target, content, trigger, scopes) do
    with {:ok, payload} <- normalize_content(content),
         {:ok, common} <- validate_target(target, trigger) do
      {:ok,
       Enum.map(scopes, fn scope ->
         config = scope.config
         system_config = scope.system_config
         community_id = community_id(scope.scope)

         policy_snapshot = %{
           "scope" => scope_name(scope.scope),
           "trigger" => Atom.to_string(trigger),
           "system_config_id" => system_config.id,
           "system_config_version" => system_config.version,
           "config_id" => config.id,
           "config_version" => config.version,
           "system_prompt" => system_config.prompt,
           "prompt" => if(scope.scope == :system, do: "", else: config.prompt),
           "ban_words" => config.ban_words
         }

         policy_snapshot =
           if scope.scope == :system do
             policy_snapshot
           else
             Map.put(policy_snapshot, "review_mode", Atom.to_string(config.review_mode))
           end

         Map.merge(common, %{
           community_id: community_id,
           policy_snapshot: policy_snapshot,
           payload: payload
         })
       end)}
    end
  end

  defp validate_target(
         %{type: :article, article_id: article_id},
         trigger
       )
       when is_binary(article_id) do
    {:ok,
     %{
       target_type: :article,
       article_id: article_id,
       subject_ref: Ecto.UUID.generate(),
       trigger: trigger
     }}
  end

  defp validate_target(
         %{type: :comment, comment_id: comment_id},
         trigger
       )
       when is_integer(comment_id) do
    {:ok,
     %{
       target_type: :comment,
       comment_id: comment_id,
       subject_ref: Ecto.UUID.generate(),
       trigger: trigger
     }}
  end

  defp validate_target(
         %{
           type: :doc,
           article_id: article_id,
           branch_id: branch_id
         },
         trigger
       )
       when is_binary(article_id) and is_integer(branch_id) do
    {:ok,
     %{
       target_type: :doc,
       article_id: article_id,
       branch_id: branch_id,
       subject_ref: Ecto.UUID.generate(),
       trigger: trigger
     }}
  end

  defp validate_target(_target, _trigger) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  defp normalize_content(%{title: title, body: body} = content)
       when is_binary(title) and is_binary(body) do
    {:ok,
     %{"text" => %{"title" => title, "body" => body}, "images" => Map.get(content, :images, [])}}
  end

  defp normalize_content(%{"title" => title, "body" => body} = content)
       when is_binary(title) and is_binary(body) do
    {:ok,
     %{"text" => %{"title" => title, "body" => body}, "images" => Map.get(content, "images", [])}}
  end

  defp normalize_content(_content) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  defp insert_scoped_requests(scopes, target) do
    Enum.reduce_while(scopes, {:ok, []}, fn attrs, {:ok, requests} ->
      case CMS.Review.Requests.create_in_transaction(attrs) do
        {:ok, request} ->
          case apply_initial_hold(request, target) do
            {:ok, :pass} -> {:cont, {:ok, [request | requests]}}
            {:error, reason} -> {:halt, {:error, reason}}
          end

        {:error, reason} ->
          {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, requests} -> {:ok, Enum.reverse(requests)}
      {:error, reason} -> {:error, reason}
    end
  end

  defp apply_initial_hold(
         %ArtimentReview{policy_snapshot: %{"scope" => "system"}},
         _target
       ) do
    {:ok, :pass}
  end

  defp apply_initial_hold(
         %ArtimentReview{policy_snapshot: %{"review_mode" => "immediate"}},
         _target
       ) do
    {:ok, :pass}
  end

  defp apply_initial_hold(%ArtimentReview{} = request, %{lifecycle: lifecycle}) do
    scope_key =
      if is_nil(request.community_id), do: "platform", else: "community:#{request.community_id}"

    case CMS.ReviewBlocks.apply(lifecycle, %{
           scope_key: scope_key,
           type: :awaiting_ai,
           artiment_review_id: request.id,
           subject_ref: request.subject_ref,
           source_ref: "request:#{request.id}:awaiting_ai",
           source: :request,
           applied_at: DateTime.utc_now(:second)
         }) do
      {:ok, _restriction} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp apply_initial_hold(_request, _target) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  defp community_id({:community, community_id}), do: community_id
  defp community_id(:system), do: nil

  defp scope_name({:community, community_id}), do: "community:#{community_id}"
  defp scope_name(:system), do: "system"
end
