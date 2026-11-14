import unittest
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1] / 'scripts'))
from forecast import brier_report, build, probability


class ForecastProtocolTests(unittest.TestCase):
    def test_pair_information_does_not_double_count_shared_threshold(self):
        design=build()['next_experiment']
        self.assertEqual(design['information_bits'],1)
        self.assertEqual(design['oxygen_pct'],26)
        pair=design['best_fixed_pair']
        self.assertAlmostEqual(sum(pair['outcome_probabilities'].values()),1)
        self.assertGreater(pair['joint_information_bits'],1.55)
        self.assertLessEqual(pair['joint_information_bits'],1.585)
        self.assertEqual(pair['oxygen_pct'],[25.5,26.5])

    def test_grounded_unscored_default_and_sensitivity(self):
        d=build()
        self.assertTrue(all(b['outcome'] is None for b in d['burns']))
        self.assertIsNone(d['scoring']['observed_model_score']['resolved_mean'])
        self.assertAlmostEqual(d['burns'][-1]['p_sustain'],0.25249253755)
        self.assertGreater(probability(25,24,1.5),probability(25,27,1.5))

    def test_void_and_pending_match_indices(self):
        report=brier_report([.1,.8,.2,.6],['void','yes','no','pending'])
        self.assertEqual(report['n_resolved'],2)
        self.assertAlmostEqual(report['resolved_mean'],.04)
        self.assertIsNone(report['full_four_burn_score'])
        with self.assertRaises(ValueError):
            brier_report([.9],['unknown'])
        with self.assertRaises(ValueError):
            probability(25,26,0)


if __name__=='__main__':
    unittest.main()
