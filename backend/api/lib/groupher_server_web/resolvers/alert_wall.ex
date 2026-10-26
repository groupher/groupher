defmodule GroupherServerWeb.Resolvers.AlertWall do
  @moduledoc """
  Scoped GraphQL reads for AlertWall's risk items.

  Business position:

      GraphQL AlertWall field
        -> resolver maps public target/scope input
          -> AlertWall query or Receipt-backed command
  """

  alias GroupherServer.{Accounts, AlertWall, CMS, FrontDesk}
  alias Accounts.Model.User
  alias AlertWall.Model.UserReport
  alias CMS.Model.{Article, Comment, Community}

  def alert_items(_parent, %{scope: %{type: :platform}} = args, %{context: %{cur_user: actor}}) do
    AlertWall.list_items(%{type: :platform}, Map.get(args, :filter), actor, Map.get(args, :pagi))
  end

  def alert_items(_parent, %{scope: %{type: :community, community: slug}} = args, %{
        context: %{cur_user: actor}
      }) do
    with {:ok, community} <- FrontDesk.community(slug, mode: :internal) do
      AlertWall.list_items(
        %{type: :community, community: community},
        Map.get(args, :filter),
        actor,
        Map.get(args, :pagi)
      )
    end
  end

  def alert_items(_parent, _args, _resolution) do
    {:error, GroupherServer.CMS.passport_error_cat_permission_denied()}
  end

  def alert_item(_parent, %{id: id}, %{context: %{cur_user: actor}}) do
    with {:ok, item_id} <- parse_id(id) do
      AlertWall.item(item_id, actor)
    end
  end

  def alert_item(_parent, _args, _resolution) do
    {:error, AlertWall.item_not_found_error()}
  end

  def item_reports(_parent, %{id: id} = args, %{context: %{cur_user: actor}}) do
    with {:ok, item_id} <- parse_id(id) do
      AlertWall.item_reports(item_id, actor, Map.get(args, :pagi))
    end
  end

  def item_reports(_parent, _args, _resolution) do
    {:error, AlertWall.item_not_found_error()}
  end

  def my_reports(_parent, args, %{context: %{cur_user: actor}}) do
    AlertWall.my_reports(actor, Map.get(args, :filter), Map.get(args, :pagi))
  end

  def my_reports(_parent, _args, _resolution) do
    {:error, GroupherServer.CMS.passport_error_cat_permission_denied()}
  end

  def submit_report(_parent, %{input: input, command_id: command_id}, %{
        context: %{cur_user: actor}
      }) do
    with {:ok, target} <- resolve_report_target(input.target, actor) do
      AlertWall.submit_report(
        target,
        input.report_type,
        Map.get(input, :details) || "",
        actor,
        command_id
      )
    end
  end

  def submit_report(_parent, _args, _resolution) do
    {:error, GroupherServer.CMS.passport_error_cat_permission_denied()}
  end

  def withdraw_report(_parent, %{report_id: report_id, command_id: command_id}, %{
        context: %{cur_user: actor}
      }) do
    with {:ok, parsed_report_id} <- parse_id(report_id) do
      AlertWall.withdraw_report(parsed_report_id, actor, command_id)
    end
  end

  def withdraw_report(_parent, _args, _resolution) do
    {:error, GroupherServer.CMS.passport_error_cat_permission_denied()}
  end

  def report_count(%{id: id}, _args, _resolution) when is_integer(id) do
    {:ok, AlertWall.active_report_count(id)}
  end

  def report_count(_item, _args, _resolution), do: {:ok, 0}

  def total_report_count(%{id: id}, _args, _resolution) when is_integer(id) do
    {:ok, AlertWall.total_report_count(id)}
  end

  def total_report_count(_item, _args, _resolution), do: {:ok, 0}

  def reporter_login(%UserReport{reporter_id: id}, _args, _resolution) do
    case FrontDesk.user(id, mode: :internal) do
      {:ok, %User{} = user} -> {:ok, user.login}
      {:error, _reason} -> {:ok, nil}
    end
  end

  def public_target_id(%{target_type: :user, target_id: id}, _args, _resolution) do
    with {user_id, ""} <- Integer.parse(id),
         {:ok, %User{} = user} <- FrontDesk.user(user_id, mode: :internal) do
      {:ok, user.login}
    else
      _ -> {:ok, nil}
    end
  end

  def public_target_id(%{target_id: id}, _args, _resolution), do: {:ok, id}

  def reported_count(%{id: user_id}, _args, _resolution) when is_integer(user_id) do
    {:ok, AlertWall.reported_count(user_id)}
  end

  def reported_count(_account, _args, _resolution), do: {:ok, 0}

  def resolve_alert_item(
        _parent,
        %{
          id: id,
          resolution: resolution,
          expected_version: expected_version,
          command_id: command_id
        },
        %{
          context: %{cur_user: actor}
        }
      ) do
    with {:ok, item_id} <- parse_id(id) do
      AlertWall.resolve_item(item_id, resolution, expected_version, actor, command_id)
    end
  end

  def resolve_alert_item(_parent, _args, _resolution) do
    {:error, GroupherServer.CMS.passport_error_cat_permission_denied()}
  end

  defp parse_id(id) when is_integer(id) and id > 0, do: {:ok, id}

  defp parse_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {integer, ""} when integer > 0 -> {:ok, integer}
      _ -> {:error, AlertWall.item_not_found_error()}
    end
  end

  defp parse_id(_id), do: {:error, AlertWall.item_not_found_error()}

  defp resolve_report_target(%{type: :article, article: path} = input, actor)
       when is_map(path) do
    with {:ok, projection} <- FrontDesk.article(path, actor),
         article_id when is_binary(article_id) <- Map.get(projection, :id),
         {:ok, %Community{} = community} <- FrontDesk.community(path.community, actor, []),
         {:ok, %Article{} = article} <-
           FrontDesk.article(article_id, mode: :internal, view: :command_context) do
      {:ok,
       %{
         owner: :cms,
         target_type: :article,
         target_id: article.id,
         observed_version: Map.get(input, :observed_version),
         community_id: community.id
       }}
    else
      _ -> {:error, AlertWall.invalid_report_error()}
    end
  end

  defp resolve_report_target(%{type: :comment, comment: path} = input, actor)
       when is_map(path) do
    with {:ok, %Comment{} = comment} <- FrontDesk.comment(path, actor) do
      {:ok,
       %{
         owner: :cms,
         target_type: :comment,
         target_id: to_string(comment.id),
         observed_version: Map.get(input, :observed_version),
         community_id: comment.community_id
       }}
    else
      _ -> {:error, AlertWall.invalid_report_error()}
    end
  end

  defp resolve_report_target(
         %{type: :doc, article: path, doc_branch_id: branch_id} = input,
         actor
       )
       when is_map(path) and is_integer(branch_id) and branch_id > 0 do
    with {:ok, projection} <- FrontDesk.article(path, actor),
         article_id when is_binary(article_id) <- Map.get(projection, :id),
         ^branch_id <- Map.get(projection, :branch_id),
         {:ok, %Article{} = article} <-
           FrontDesk.article(article_id, mode: :internal, view: :command_context) do
      {:ok,
       %{
         owner: :cms,
         target_type: :doc,
         target_id: "#{article.id}:#{branch_id}",
         observed_version: Map.get(input, :observed_version),
         community_id: nil
       }}
    else
      _ -> {:error, AlertWall.invalid_report_error()}
    end
  end

  defp resolve_report_target(%{type: :user, user_login: login}, actor)
       when is_binary(login) and login != "" do
    with {:ok, %User{} = user} <- FrontDesk.user(login, mode: :public, view: :default),
         false <- user.id == actor.id do
      {:ok,
       %{
         owner: :accounts,
         target_type: :user,
         target_id: to_string(user.id),
         community_id: nil
       }}
    else
      _ -> {:error, AlertWall.invalid_report_error()}
    end
  end

  defp resolve_report_target(_target, _actor) do
    {:error, AlertWall.invalid_report_error()}
  end
end
