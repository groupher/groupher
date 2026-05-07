defmodule Helper.DatetimeTest do
  use ExUnit.Case, async: true

  alias Helper.Datetime

  describe "to_datetime/1" do
    test "normalizes DateTime inputs to UTC" do
      assert Datetime.to_datetime(non_utc_datetime()) == ~U[2026-05-06 17:30:00Z]
    end
  end

  describe "to_date/1" do
    test "returns the UTC date for DateTime inputs" do
      assert Datetime.to_date(non_utc_datetime()) == ~D[2026-05-06]
    end
  end

  defp non_utc_datetime do
    %DateTime{
      calendar: Calendar.ISO,
      year: 2026,
      month: 5,
      day: 7,
      hour: 1,
      minute: 30,
      second: 0,
      microsecond: {0, 0},
      time_zone: "Asia/Shanghai",
      zone_abbr: "CST",
      utc_offset: 8 * 60 * 60,
      std_offset: 0
    }
  end
end
