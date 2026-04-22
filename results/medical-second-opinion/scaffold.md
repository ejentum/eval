# v4 Scaffold (live, mode=None)

**Agent-crafted query:**
Patient is a 45-year-old male reporting sluggishness. Lab results show fasting glucose at 108 mg/dL, HbA1c at 5.8%, LDL cholesterol at 145 mg/dL, HDL cholesterol at 38 mg/dL, triglycerides at 180 mg/dL, and vitamin D at 22 ng/mL. Primary physician recommended better diet and exercise.

**API response:**

```
[PRIMARY]
[PROCEDURE]
Step 1: Map the current knowledge frontier and identify gaps where information is missing or uncertain. Step 2: Rank each gap by expected value, estimating how much resolution would advance the goal. Step 3: Identify the most efficient foraging strategy for the top-ranked gap, choosing between inference, analogy, or decomposition. Step 4: Verify that foraging effort targets high-value gaps. If effort drifts to low-value areas, halt and redirect. Step 5: Extract acquired information and integrate it before pursuing the next gap. Step 6: Never allow aimless information gathering. If epistemic ceiling persists after directed foraging, flag the limit and constrain scope. Amplify variable seeking.

[REASONING TOPOLOGY]
N{allow_aimless_information_gathering} → S1:map_knowledge_frontier_exhaustively → ACC[all_gaps] → S2:rank_gaps_by_expected_information_value → SORTED[prioritized_gaps] W[expected_information_value:descending] → S3:select_foraging_strategy_for_top_gap → S4:forage_and_integrate → G1{frontier_advanced?} --yes→ M_IC{Before re-mapping the knowledge frontier: am I genuinely converging on closing high-value gaps, or am I stuck foraging in low-value areas because easy gaps are more tractable? Check: has the frontier actually advanced — can I name the specific new knowledge integrated? Test: compare the information value of what was gained against the highest-ranked remaining gap.} --working→ S1[LOOP:convergence] --failing→ FREEFORM{The frontier has not advanced because I am foraging low-value gaps. I am data-starved on the important question and distracted by tractable trivia. I must abandon the current foraging path and redirect to the top-ranked gap even if it requires a harder strategy.} → RE-ENTER at S2 --no→ MOD:saturation(diminishing_returns→EXIT) → OUT:knowledge_state

[FALSIFICATION TEST]
If a conclusion is drawn from insufficient data without verifying first directing a search for the missing information, foraging direction was skipped.

[SUPPRESSION GRAPH]
N{allow_aimless_information_gathering}
N{count_same_evidence_multiple_ways}
N{allow_local_optima_trapping_to_prevent_exploration_of}
N{commit_to_fixed_metarules_without_testing_fit}

[META-CHECKPOINT]
M{PAUSE — Before output, verify you did NOT:
- allow aimless information gathering
- count same evidence multiple ways
- allow local optima trapping to prevent exploration of
- commit to fixed metarules without testing fit
If any violation detected — STOP → ON_FAILURE}

[ON_FAILURE] ABANDON_GRAPH → FREEFORM{Name the assumption that failed. Construct one alternative approach that does not rely on it.} → RE-ENTER

Amplify: targeted query gen; variable seeking; belief entropy computation; credence distribution tracking; uncertainty bound enforcement; high entropy query generation; exploration state expansion; adjacency scanning; meta self model; process optimisation
Suppress: hallucinated blanks; epistemic ceiling acceptance; premature certainty crystallization; diffuse belief inertia; exploitation lock; local optima trapping; fixed meta rules; meta stasis
```
