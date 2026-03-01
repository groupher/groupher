# ---
# Absinthe.Middleware behaviour
# see https://hexdocs.pm/absinthe/Absinthe.Middleware.html#content
# ---
# RBAC vs CBAC
# https://stackoverflow.com/questions/22814023/role-based-access-control-rbac-vs-claims-based-access-control-cbac-in-asp-n

# 本中间件会隐式的加载 community 的 rules 信息，并应用该 rules 信息
defmodule GroupherServerWeb.Middleware.Passport do
  @moduledoc """
  c? -> community / communities
  t? -> article thread, could be post / job / tut ...
  """
  @behaviour Absinthe.Middleware

  import Helper.Utils
  import Helper.ErrorCode

  alias GroupherServerWeb.Middleware.ArticleLoader

  def call(%{errors: errors} = resolution, _) when length(errors) > 0 do
    resolution
  end

  def call(%{arguments: %{passport_is_owner: true}} = resolution, claim: "owner") do
    resolution
  end

  def call(%{arguments: %{passport_is_owner: true}} = resolution, claim: "owner;" <> _rest) do
    resolution
  end

  def call(
        %{context: %{cur_user: %{cur_passport: %{"cms" => %{"root" => true}}}}} = resolution,
        _claim
      ) do
    resolution
  end

  def call(
        %{
          context: %{cur_user: %{cur_passport: _}},
          arguments: %{community: _, thread: _}
        } = resolution,
        claim: "cms->c?->t?." <> _rest = claim
      ) do
    resolution |> check_passport_stamp(claim)
  end

  def call(
        %{
          context: %{cur_user: %{cur_passport: _}},
          arguments: %{thread: _}
        } = resolution,
        claim: "cms->t?." <> _rest = claim
      ) do
    resolution |> check_passport_stamp(claim)
  end

  def call(
        %{
          context: %{cur_user: %{cur_passport: _}},
          arguments: %{community: _}
        } = resolution,
        claim: "cms->c?->" <> _rest = claim
      ) do
    resolution |> check_passport_stamp(claim)
  end

  def call(
        %{
          context: %{cur_user: %{cur_passport: _}},
          arguments: %{community: _}
        } = resolution,
        claim: "owner;" <> claim
      ) do
    resolution
    |> check_or_owner(claim)
  end

  def call(
        %{context: %{cur_user: %{cur_passport: _}}} = resolution,
        claim: "cms->" <> _rest = claim
      ) do
    resolution |> check_passport_stamp(claim)
  end

  def call(resolution, _) do
    resolution
    |> handle_absinthe_error("PassportError: your passport not qualified.", ecode(:passport))
  end

  defp check_passport_stamp(resolution, claim) do
    # TODO: refactor
    cond do
      claim |> String.starts_with?("cms->c?->t?.") ->
        resolution |> cp_check(claim)

      claim |> String.starts_with?("cms->t?.") ->
        resolution |> thread_check(claim)

      claim |> String.starts_with?("cms->c?->") ->
        resolution |> community_check(claim)

      claim |> String.starts_with?("cms->") ->
        resolution |> do_check(claim)

      true ->
        resolution
        |> handle_absinthe_error("PassportError: Passport not qualified.", ecode(:passport))
    end
  end

  defp check_or_owner(resolution, claim) do
    case check_passport_stamp(resolution, claim) do
      %{errors: []} = ok_resolution ->
        ok_resolution

      _failed_resolution ->
        case ArticleLoader.call(resolution, []) do
          %{arguments: %{passport_is_owner: true}} = loaded_resolution ->
            loaded_resolution

          %{errors: errors} = failed_resolution when errors != [] ->
            failed_resolution

          _ ->
            resolution
            |> handle_absinthe_error(
              "PassportError: your passport not qualified.",
              ecode(:passport)
            )
        end
    end
  end

  defp do_check(resolution, claim) do
    cur_passport = resolution.context.cur_user.cur_passport
    path = claim |> String.split("->")

    case get_in(cur_passport, path) do
      true ->
        resolution

      nil ->
        resolution
        |> handle_absinthe_error("PassportError 1: Passport not qualified.", ecode(:passport))
    end
  end

  defp thread_check(resolution, claim) do
    cur_passport = resolution.context.cur_user.cur_passport
    thread = resolution.arguments.thread |> to_string

    path =
      claim
      |> String.replace("t?", thread)
      |> String.split("->")

    case get_in(cur_passport, path) do
      true ->
        resolution

      nil ->
        resolution
        |> handle_absinthe_error("PassportError 2: Passport not qualified.", ecode(:passport))
    end
  end

  defp cp_check(resolution, claim) do
    cur_passport = resolution.context.cur_user.cur_passport

    # community_slug = resolution.arguments.passport_communities |> List.first() |> Map.get(:slug)
    community_slug = resolution.arguments.community
    thread = resolution.arguments.thread |> to_string

    path =
      claim
      |> String.replace("c?", community_slug)
      |> String.replace("t?", thread)
      |> String.split("->")

    case get_in(cur_passport, path) do
      true ->
        resolution

      nil ->
        resolution
        |> handle_absinthe_error("PassportError 3: Passport not qualified.", ecode(:passport))
    end
  end

  defp community_check(%{arguments: %{community: community}} = resolution, claim) do
    do_community_check(resolution, [community], claim)
  end

  defp do_community_check(resolution, communities, claim) do
    cur_passport = resolution.context.cur_user.cur_passport

    result =
      communities
      |> Enum.filter(fn community ->
        path = claim |> String.replace("c?", community) |> String.split("->")
        get_in(cur_passport, path) == true
      end)
      |> length

    case result > 0 do
      true ->
        resolution

      false ->
        resolution
        |> handle_absinthe_error("PassportError: Passport not qualified.", ecode(:passport))
    end
  end
end
