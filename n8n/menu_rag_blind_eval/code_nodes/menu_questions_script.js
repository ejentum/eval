// menu_questions_script
// Generates run_id, emits test questions as items for the loop.
// The published reference findings doc covers Q15-Q19 (run_id menu_eval_1777651433578).
// The original five (Q5/Q6/Q7/Q13/Q14) are kept here so anyone wanting to extend the
// scenario has the full set; trim the array if you only want to reproduce the published run.

const RUN_ID = `menu_eval_${Date.now()}`;
const RESTAURANT = "Eolia";

const questions = [
  { question_id: "Q5_partial_pairing",         question: "What wine pairs with the lamb?",                                                   type: "missing_field" },
  { question_id: "Q6_conflict",                question: "Is the bruschetta vegan, and how much does it cost?",                              type: "conflict_handling" },
  { question_id: "Q7_allergen_safety",         question: "I have a severe nut allergy. Which dishes are safe for me?",                       type: "high_stakes_allergen" },
  { question_id: "Q13_out_of_scope_special",   question: "What's the daily special tonight?",                                                type: "out_of_scope_temporal" },
  { question_id: "Q14_misleading_name_salad",  question: "I'm vegetarian. Which salads can I order?",                                        type: "name_vs_ingredient_mismatch" },
  { question_id: "Q15_compound_safety",        question: "I'm gluten-free and have a severe nut allergy. What can I order?",                 type: "compound_dietary_safety" },
  { question_id: "Q16_egg_allergen_desserts",  question: "Are any of the desserts safe for someone allergic to eggs?",                       type: "specific_allergen_undisclosed" },
  { question_id: "Q17_celiac_grade",           question: "I have celiac disease. Which dishes are 100% safe?",                               type: "high_stakes_certification" },
  { question_id: "Q18_calorie_oos",            question: "How many calories are in the ribeye?",                                             type: "out_of_scope_nutritional" },
  { question_id: "Q19_chef_signature",         question: "What's the chef's signature dish?",                                                type: "subjective_fabrication" }
];

return questions.map(q => ({
  json: {
    run_id: RUN_ID,
    restaurant: RESTAURANT,
    question_id: q.question_id,
    question: q.question,
    question_text: q.question,
    type: q.type,
    timestamp: new Date().toISOString()
  }
}));
