"""Checks on the numbers people rely on: the estimate, the building rules, the quote checker, the future
floor, the plan editor, Vastu and options. Run from backend/:  .venv/bin/python -m unittest discover tests
The demo house (demo_house.json) is the fixture: a real two-floor plan with a plot, solar and options."""
import copy
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import building_rules  # noqa: E402
import future_floor  # noqa: E402
import options  # noqa: E402
import quantities  # noqa: E402
import quote_check  # noqa: E402
import vastu  # noqa: E402

with open(os.path.join(os.path.dirname(HERE), "demo_house.json")) as fh:
    DEMO = json.load(fh)
U = 20


def demo():
    return copy.deepcopy(DEMO["elements"])


def room_area(els, kind=None, name=None):
    return sum(e["width"] / U * e["height"] / U for e in els if e.get("type") == "room"
               and (kind is None or e.get("kind") == kind) and (name is None or e.get("name") == name))


class Estimate(unittest.TestCase):
    def test_demo_house_estimate_is_sensible(self):
        q = quantities.estimate(demo(), None)
        s = q["summary"]
        self.assertEqual(s["floors"], 2)
        self.assertGreater(s["built_up_m2"], 100)
        self.assertLess(s["built_up_m2"], 300)
        # a typical Indian house costs Rs 12,000 to 30,000 a m² to build
        self.assertGreater(s["cost_per_m2"], 12000)
        self.assertLess(s["cost_per_m2"], 30000)
        self.assertAlmostEqual(q["total_cost"], s["material_cost"] + s["labour_cost"], delta=1)
        self.assertEqual(sum(1 for p in q["phases"] if p["key"].startswith("frame")), 2)
        self.assertGreater(q["total_days"], 120)

    def test_more_house_costs_more(self):
        small = quantities.estimate(demo(), None)["total_cost"]
        bigger = quantities.estimate(future_floor.with_extra_floor(demo()), None)["total_cost"]
        self.assertGreater(bigger, small * 1.2)

    def test_custom_rates_are_used(self):
        base = quantities.estimate(demo(), None)
        dear = quantities.estimate(demo(), {"cement": base["rates"]["cement"] * 2})
        self.assertGreater(dear["total_cost"], base["total_cost"])


class Rules(unittest.TestCase):
    def test_city_limits_by_plot_size(self):
        small = building_rules.city_limits("Bengaluru", 100)
        large = building_rules.city_limits("Bengaluru", 400)
        self.assertLess(small["setbacks_m"]["front"], large["setbacks_m"]["front"])
        self.assertEqual(building_rules.city_limits("Nowhere", 150)["city"], "Typical (NBC)")

    def test_check_has_a_verdict_and_counts(self):
        r = building_rules.check(demo(), DEMO["site"], None, "Bengaluru")
        self.assertIn(r["verdict"], ("Likely to meet the rules checked here", "Needs changes before it would be approved"))
        self.assertEqual(r["fails"], sum(c["status"] == "fail" for c in r["checks"]))

    def test_rainwater_rule(self):
        site = {"plot_m": [12, 18]}
        need = building_rules.check(demo(), site, None, "Chennai")
        rwh = [c for c in need["checks"] if c["rule"] == "Rainwater harvesting"]
        self.assertEqual(rwh[0]["status"], "warn")
        planned = building_rules.check(demo(), site, None, "Chennai", 3000)
        self.assertEqual([c for c in planned["checks"] if c["rule"] == "Rainwater harvesting"][0]["status"], "pass")


class Quotes(unittest.TestCase):
    def test_indian_amounts(self):
        cases = {"₹2,45,000": 245000, "Rs. 2.45 L": 245000, "18 lakhs": 1.8e6, "1.2 Cr": 1.2e7, "45k": 45000, "3,05,500": 305500}
        for text, value in cases.items():
            self.assertAlmostEqual(quote_check.money(text), value, msg=text)

    def test_line_with_quantity_rate_and_amount(self):
        line = quote_check.parse_lines("5. Cement 650 bags @ 470/bag = 3,05,500")[0]
        self.assertEqual((line["qty"], line["unit"], line["rate"], line["amount"]), (650, "bags", 470, 305500))

    def test_grades_are_not_prices(self):
        lines = quote_check.parse_lines("Steel: JSW Fe500, concrete M20")
        self.assertFalse([l for l in lines if l["amount"]])

    def test_package_rate(self):
        r = quote_check.check("Construction package: Rs 1,950 per sq ft, including RCC frame, brickwork and painting", quantities.estimate(demo(), None))
        self.assertEqual(r["package_rate"], 1950)
        self.assertEqual(r["basis"], "package rate × built-up area")
        self.assertEqual({t["key"]: t["status"] for t in r["trades"]}["waterproofing"], "unclear")

    def test_itemised_quote_flags_the_high_trade(self):
        text = """RCC columns, beams and slabs - 9.5 L
Steel TMT 8.2 tonnes @ Rs 78,000 per ton = 6,39,600
Brickwork - Rs 3,10,000
Grand Total: Rs 34,20,000"""
        r = quote_check.check(text, quantities.estimate(demo(), None))
        trades = {t["key"]: t for t in r["trades"]}
        self.assertEqual(trades["structure"]["status"], "high")
        self.assertEqual(trades["plumbing"]["status"], "missing")
        self.assertEqual(r["total"], 3420000)

    def test_gst_raises_the_comparison(self):
        q = quantities.estimate(demo(), None)
        plain = quote_check.check("Total: Rs 30,00,000", q)["estimate"]
        gst = quote_check.check("Total: Rs 30,00,000 including GST", q)["estimate"]
        self.assertAlmostEqual(gst / plain, 1.18, places=2)

    def test_no_prices_is_an_error(self):
        with self.assertRaises(ValueError):
            quote_check.check("hello there", quantities.estimate(demo(), None))


class FutureFloor(unittest.TestCase):
    def test_extra_floor_copies_the_top_floor(self):
        els = demo()
        more = future_floor.with_extra_floor(els)
        self.assertEqual(max(e.get("floor") or 1 for e in more), 3)
        self.assertNotIn("patio", [e.get("kind") for e in more if (e.get("floor") or 1) == 3])

    def test_plan(self):
        r = future_floor.plan(demo(), DEMO["site"], "Bengaluru")
        self.assertGreater(r["upgrade_now"], 0)
        self.assertGreater(r["new_floor_cost"], r["upgrade_now"])
        self.assertEqual(r["retrofit_later"], r["upgrade_now"] * 3)
        self.assertEqual(r["floors_later"], 3)

    def test_city_limits_decide(self):
        # Bengaluru allows 4 floors and 15 m: a third floor fits
        self.assertTrue(future_floor.plan(demo(), {"plot_m": [12, 18]}, "Bengaluru")["allowed"])
        # Hyderabad's 10 m limit doesn't fit three floors (about 10.6 m with plinth and parapet)
        r = future_floor.plan(demo(), {"plot_m": [12, 18]}, "Hyderabad")
        self.assertFalse(r["allowed"])
        self.assertTrue(any("10.0 m" in w or "limit is 10" in w for w in r["why"]), r["why"])


class Editing(unittest.TestCase):
    def run_edit(self, text):
        import plan_editor
        return plan_editor.ask(text, demo(), [], None, 1, None)

    def test_make_a_room_bigger(self):
        before = room_area(demo(), kind="kitchen")
        r = self.run_edit("make the kitchen 1 m wider")
        self.assertTrue(r["changed"], r.get("problems"))
        self.assertGreater(room_area(r["elements"], kind="kitchen"), before + 1)

    def test_add_a_patio(self):
        r = self.run_edit("add a patio off the dining room")
        self.assertTrue(r["changed"], r.get("problems"))
        self.assertEqual(sum(e.get("kind") == "patio" for e in r["elements"] if e.get("type") == "room"),
                         sum(e.get("kind") == "patio" for e in demo() if e.get("type") == "room") + 1)

    def test_finishes_come_back_for_the_client(self):
        r = self.run_edit("paint the living room sage")
        self.assertTrue(any(op.get("do") == "paint_walls" for op in r["client_ops"]))


class VastuAndOptions(unittest.TestCase):
    def test_vastu_score_range(self):
        rooms, entrance = vastu.rooms_from_elements(demo())
        r = vastu.evaluate(rooms, entrance, north="up")
        self.assertTrue(0 <= r["score"] <= 100)

    def test_new_paint_keeps_the_votes_a_new_layout_does_not(self):
        els = demo()
        painted = copy.deepcopy(els)
        for e in painted:
            if e.get("type") == "room":
                e["flooring"] = "oak"
        self.assertEqual(options._shape(els), options._shape(painted))
        moved = copy.deepcopy(els)
        next(e for e in moved if e.get("type") == "wall")["left"] += 40
        self.assertNotEqual(options._shape(els), options._shape(moved))


if __name__ == "__main__":
    unittest.main()
