defmodule Helper.Constant.DBPrefix do
  @moduledoc """
  this is the prefix for all tables in database, group alias
  """

  @default "public"
  @cms "cms"
  @account "account"
  @statistics "statistics"
  @delivery "delivery"
  @messaging "messaging"
  @payment "payment"
  @log "log"

  def default, do: @default
  def cms, do: @cms
  def messaging, do: @messaging
  def delivery, do: @delivery
  def statistics, do: @statistics
  def account, do: @account
  def payment, do: @payment
  def log, do: @log
end
