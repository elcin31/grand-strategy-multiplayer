import importlib.util
import math
from pathlib import Path
import sys
import unittest

sys.path.insert(0,str(Path(__file__).parents[1]/'scripts'))
spec=importlib.util.spec_from_file_location('repeated_camera23',Path(__file__).parents[1]/'scripts/compare-camera23-repeated.py')
repeated=importlib.util.module_from_spec(spec);spec.loader.exec_module(repeated)


class RepeatedCameraTest(unittest.TestCase):
    def test_pool_retains_tail_stalls_that_best_run_or_median_of_quantiles_would_hide(self):
        result=repeated.quantiles([[20]*96+[400]*4,[20]*100,[20]*100])
        self.assertEqual(result['intervals'],300)
        self.assertEqual(result['p50Ms'],20)
        self.assertEqual(result['p95Ms'],20)
        self.assertEqual(result['p99Ms'],400)
        self.assertEqual(result['maxMs'],400)

    def test_no_missing_group_nonfinite_or_nonpositive_interval_is_accepted(self):
        for groups in [[],[[1],[]],[[0]],[[float('nan')]],[[float('inf')]],[[True]],[[-1]]]:
            with self.subTest(groups=groups),self.assertRaises(AssertionError):repeated.quantiles(groups)

    def test_each_pooled_quantile_uses_the_same_nearest_rank_rule(self):
        values=list(range(1,301));result=repeated.quantiles([values[:100],values[100:200],values[200:]])
        for key,q in [('p50Ms',.5),('p95Ms',.95),('p99Ms',.99)]:self.assertEqual(result[key],values[math.ceil(len(values)*q)-1])
