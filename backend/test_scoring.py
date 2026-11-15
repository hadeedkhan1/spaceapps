import unittest

from backend.scoring import CATEGORIES, score_category, score_overall


def rows(values, start_day=1):
    return [{"value": v, "recorded_at": f"2026-10-{start_day + i:02d}T08:00:00+00:00"} for i, v in enumerate(values)]


class ScoringTests(unittest.TestCase):
    def test_needs_before_data(self):
        out = score_category("heart_rate", [], rows([70]))
        self.assertEqual(out["status"], "needs_before_data")
        self.assertEqual(out["color"], "grey")

    def test_needs_after_data(self):
        out = score_category("heart_rate", rows([60, 61]), [])
        self.assertEqual(out["status"], "needs_after_data")

    def test_stable_is_green(self):
        out = score_category("heart_rate", rows([60, 61, 60, 62, 61]), rows([61, 60, 62], 10))
        self.assertEqual(out["color"], "green")
        self.assertFalse(out["drift_detected"])

    def test_sustained_rise_in_heart_rate_leaves_green(self):
        out = score_category("heart_rate", rows([60, 61, 60, 62, 61, 60, 61]), rows([71, 72, 73, 74, 75], 10))
        self.assertNotEqual(out["color"], "green")
        self.assertTrue(out["drift_detected"])

    def test_low_sleep_is_bad_but_high_sleep_is_not(self):
        base = rows([7.5, 7.4, 7.6, 7.5])
        low = score_category("sleep_hours", base, rows([5.5, 5.4, 5.6], 10))
        high = score_category("sleep_hours", base, rows([9.5, 9.6, 9.4], 10))
        self.assertLess(low["score"], high["score"])

    def test_blood_pressure_is_two_sided(self):
        base = rows([118, 120, 119, 121])
        up = score_category("blood_pressure", base, rows([140, 142, 141], 10))
        down = score_category("blood_pressure", base, rows([96, 95, 97], 10))
        self.assertNotEqual(up["color"], "green")
        self.assertNotEqual(down["color"], "green")

    def test_series_and_last_recorded(self):
        out = score_category("glucose", rows([90, 92]), rows([93], 10))
        self.assertEqual([p["phase"] for p in out["series"]], ["before", "before", "after"])
        self.assertEqual(out["last_recorded"], "2026-10-10")

    def test_overall_caps_when_any_red(self):
        good = score_category("glucose", rows([90, 92, 91]), rows([91, 92, 90], 10))
        bad = score_category("heart_rate", rows([60, 61, 60]), rows([120, 125, 130], 10))
        overall = score_overall([good, bad])
        self.assertLessEqual(overall["score"], 6.9)
        self.assertEqual(overall["worst"][0]["category"], "heart_rate")

    def test_every_category_scores(self):
        for category in CATEGORIES:
            out = score_category(category, rows([5, 5, 5]), rows([5, 5, 5], 10))
            self.assertEqual(out["status"], "scored")


if __name__ == "__main__":
    unittest.main()
