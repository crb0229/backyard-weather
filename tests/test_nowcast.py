"""Rainbow nowcast summary: start, end, type and strength of the next shower.
Run: python3 -m unittest discover -s tests -p "test_*.py"
"""
import os, sys, unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import wx

NOW = 1_800_000_000


def minutes(rates, kind="rain"):
    """One forecast entry per minute from NOW, with the given rates (mm/h)."""
    return [{"timestampBegin": NOW + i * 60, "timestampEnd": NOW + i * 60 + 60, "precipRate": r, "precipType": kind}
            for i, r in enumerate(rates)]


class Summary(unittest.TestCase):
    def test_dry(self):
        s = wx.nowcast_summary(minutes([0] * 240), NOW)
        self.assertIsNone(s["start"])
        self.assertEqual(s["until"], NOW + 7200)

    def test_starts_later_and_ends(self):
        s = wx.nowcast_summary(minutes([0] * 12 + [1.0] * 30 + [0] * 198), NOW)
        self.assertEqual(s["start"], NOW + 12 * 60)
        self.assertEqual(s["end"], NOW + 42 * 60)
        self.assertEqual((s["type"], s["strength"]), ("rain", "light"))

    def test_raining_now_short_break_is_one_shower(self):
        s = wx.nowcast_summary(minutes([3.0] * 20 + [0] * 5 + [8.0] * 10 + [0] * 205), NOW)
        self.assertEqual(s["start"], NOW)
        self.assertEqual(s["end"], NOW + 35 * 60)
        self.assertEqual(s["strength"], "heavy")

    def test_still_going_at_window_end(self):
        s = wx.nowcast_summary(minutes([0] * 100 + [4.0] * 140), NOW)
        self.assertEqual(s["start"], NOW + 100 * 60)
        self.assertIsNone(s["end"])
        self.assertEqual(s["strength"], "moderate")

    def test_snow_scale(self):
        s = wx.nowcast_summary(minutes([1.5] * 30 + [0] * 210, "snow"), NOW)
        self.assertEqual((s["type"], s["strength"]), ("snow", "moderate"))

    def test_ignores_rain_past_two_hours_and_missing_rates(self):
        f = minutes([0] * 130 + [5.0] * 20)
        f[3]["precipRate"] = None
        self.assertIsNone(wx.nowcast_summary(f, NOW)["start"])


if __name__ == "__main__":
    unittest.main()
