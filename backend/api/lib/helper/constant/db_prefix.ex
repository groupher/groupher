defmodule Helper.Constant.DBPrefix do
  @moduledoc """
  Canonical PostgreSQL schema prefixes used by Ecto schemas and migrations.

  Keeping these names in one module prevents domain schemas from drifting onto
  differently named database namespaces.

  Business position:

      Domain or web caller
        -> DBPrefix
        -> normalized value / infrastructure
  """

  @default "public"
  @cms "cms"
  @account "account"
  @statistics "statistics"
  @delivery "delivery"
  @messaging "messaging"
  @log "log"
  @activity "activity"
  @alert_wall "alert_wall"
  @review_bot "review_bot"

  @doc "Returns the default PostgreSQL schema prefix."
  def default, do: @default
  @doc "Returns the CMS PostgreSQL schema prefix."
  def cms, do: @cms
  @doc "Returns the Messaging PostgreSQL schema prefix."
  def messaging, do: @messaging
  @doc "Returns the Delivery PostgreSQL schema prefix."
  def delivery, do: @delivery
  @doc "Returns the Statistics PostgreSQL schema prefix."
  def statistics, do: @statistics
  @doc "Returns the Accounts PostgreSQL schema prefix."
  def account, do: @account
  @doc "Returns the Log PostgreSQL schema prefix."
  def log, do: @log
  @doc "Returns the Activity PostgreSQL schema prefix."
  def activity, do: @activity
  @doc "Returns the AlertWall PostgreSQL schema prefix."
  def alert_wall, do: @alert_wall
  @doc "Returns the ReviewBot PostgreSQL schema prefix."
  def review_bot, do: @review_bot
end
