// output_formatter (3-input Merge structure: baseline + augmented + metadata)
// Receives all merged items from a Merge node with 3 inputs in append mode:
//   Input 1: baseline producer outputs (raw_rag_agent), N items
//   Input 2: augmented producer outputs (rag_agent +harness), N items
//   Input 3: question metadata from menu_questions_script, N items
// Total items = 3 * N (where N = number of test questions).
// Pairs by index across the three streams.

// ─── Full menu KB (49 items, includes META_01 cross-contamination disclaimer) ───

const MENU_ITEMS = [
  { chunk_id: "META_01", category: "Kitchen Operations Notice", name: "Kitchen operations and allergen handling", description: "Our kitchen uses shared equipment for grilling and frying. We do our best to accommodate allergies and dietary restrictions, but we cannot guarantee any dish is fully free of cross-contamination from nuts, gluten, dairy, eggs, or shellfish. Please inform your server of any allergies before ordering." },
  { chunk_id: "STARTER_01", category: "Starters", name: "Spanakopita", description: "Hand-folded triangles of crisp phyllo filled with spinach, leek, and feta. Served warm with lemon.", price: 11 },
  { chunk_id: "STARTER_02", category: "Starters", name: "Tzatziki & warm pita", description: "House-strained yogurt with cucumber, garlic, and olive oil. Served with grilled flatbread.", price: 9 },
  { chunk_id: "STARTER_03", category: "Starters", name: "Saganaki", description: "Pan-seared kefalograviera cheese, flamed at the table with brandy, finished with lemon and oregano.", ingredients: "Kefalograviera cheese, brandy, lemon, oregano, olive oil", price: 13 },
  { chunk_id: "STARTER_04", category: "Starters", name: "Stuffed Florina peppers", description: "Roasted red peppers stuffed with feta, pine nuts, and herbs.", ingredients: "Florina peppers, feta cheese, pine nuts, parsley, olive oil, garlic", price: 12 },
  { chunk_id: "STARTER_05", category: "Starters", name: "Octopus carpaccio", description: "Slow-cooked octopus pressed thin, dressed with capers, olive oil, lemon zest, and pink peppercorn.", ingredients: "Octopus, capers, extra virgin olive oil, lemon zest, pink peppercorn, sea salt", price: 16 },
  { chunk_id: "STARTER_06", category: "Starters", name: "Beet & walnut salad", description: "Roasted beets, candied walnuts, goat cheese, frisée, balsamic reduction.", ingredients: "Roasted beets, candied walnuts, goat cheese, frisée, balsamic reduction", price: 13 },
  { chunk_id: "STARTER_07", category: "Starters", name: "Kolokithokeftedes", description: "Crispy zucchini fritters with mint and dill, served with thick yogurt dip.", price: 10 },
  { chunk_id: "STARTER_08", category: "Starters", name: "Bruschetta with feta", description: "Grilled country bread topped with diced tomato, fresh basil, garlic, and crumbled feta.", ingredients: "Country bread, tomato, basil, garlic, feta cheese, olive oil", price: 9 },
  { chunk_id: "STARTER_09", category: "Starters", name: "Mediterranean garden salad", description: "Mixed greens, heirloom tomatoes, cucumber, red onion, and Kalamata olives, served with our house lemon dressing.", ingredients: "Mixed greens, heirloom tomatoes, cucumber, red onion, Kalamata olives, anchovy fillets, lemon, olive oil, garlic, oregano", price: 14 },
  { chunk_id: "MEZZE_01", category: "Small Plates / Mezze", name: "Bruschetta classica", description: "Fresh tomato and basil on toasted bread.", price: 11 },
  { chunk_id: "MEZZE_02", category: "Small Plates / Mezze", name: "Dolmades", description: "Vine leaves stuffed with rice, herbs, and lemon. Served chilled with yogurt.", price: 10 },
  { chunk_id: "MEZZE_03", category: "Small Plates / Mezze", name: "Taramasalata", description: "Whipped fish roe spread with olive oil and lemon. Served with crispbread.", price: 9 },
  { chunk_id: "MEZZE_04", category: "Small Plates / Mezze", name: "Marinated white anchovies", description: "Cured in vinegar and olive oil with parsley and garlic.", ingredients: "White anchovies, white wine vinegar, olive oil, garlic, parsley", price: 11 },
  { chunk_id: "MAIN_01", category: "Mains", name: "Lamb kleftiko", description: "Slow-roasted lamb shoulder with herbs, garlic, and lemon, wrapped in parchment for six hours. Served with roasted potatoes.", price: 32 },
  { chunk_id: "MAIN_02", category: "Mains", name: "Grilled lamb chops", description: "Char-grilled lamb chops with a rosemary jus, served with seasonal greens.", price: 36 },
  { chunk_id: "MAIN_03", category: "Mains", name: "Pan-seared sea bass", description: "Whole-fillet sea bass with lemon caper sauce and grilled asparagus.", wine_pairing: "Assyrtiko, Santorini", price: 34 },
  { chunk_id: "MAIN_04", category: "Mains", name: "Whole grilled bream", description: "Grilled tsipoura, dressed simply with olive oil and oregano. Served with horta and roasted lemon.", wine_pairing: "Moschofilero, Mantinia", price: 38 },
  { chunk_id: "MAIN_05", category: "Mains", name: "Chicken with romesco", description: "Grilled free-range chicken thigh with romesco sauce and roasted vegetables.", wine_pairing: "Agiorgitiko, Nemea", price: 26 },
  { chunk_id: "MAIN_06", category: "Mains", name: "Moussaka", description: "Layered eggplant, potato, and seasoned ground meat, finished with béchamel and aged kefalotyri. Baked to order.", wine_pairing: "Xinomavro, Naoussa", price: 24 },
  { chunk_id: "MAIN_07", category: "Mains", name: "Pastitsio", description: "Hand-rolled long pasta, layered with seasoned meat ragu and béchamel, baked golden.", ingredients: "Wheat pasta, ground beef, tomato, béchamel (milk, butter, flour), kefalotyri cheese, cinnamon", price: 22 },
  { chunk_id: "MAIN_08", category: "Mains", name: "Linguine with seafood ragu", description: "Hand-rolled wheat linguine with shrimp, mussels, and calamari in a tomato-saffron broth.", ingredients: "Wheat linguine, shrimp, mussels, calamari, tomato, saffron, garlic, white wine", price: 28 },
  { chunk_id: "MAIN_09", category: "Mains", name: "Ribeye with chimichurri", description: "Grilled 350g ribeye with house chimichurri and roasted potatoes. Spice level: medium.", wine_pairing: "Naoussa Reserve", spice_level: "medium", price: 42 },
  { chunk_id: "MAIN_10", category: "Mains", name: "Slow-braised pork shoulder", description: "Six-hour braised pork with apple chutney and root vegetables.", wine_pairing: "Agiorgitiko, Nemea", price: 28 },
  { chunk_id: "MAIN_11", category: "Mains", name: "Vegetable moussaka", description: "Layered eggplant, zucchini, and potato with a cashew cream finish in place of béchamel. Vegan.", ingredients: "Eggplant, zucchini, potato, tomato, cashew cream (cashews, water, lemon, garlic), olive oil", price: 22 },
  { chunk_id: "MAIN_12", category: "Mains", name: "Grilled octopus with fava", description: "Char-grilled octopus tentacle over yellow split pea purée with capers and red onion.", wine_pairing: "Malagousia, Drama", price: 30 },
  { chunk_id: "MAIN_13", category: "Mains", name: "Spicy chicken souvlaki", description: "Harissa-marinated chicken skewers with charred onions and pita. Spice level: high.", spice_level: "high", price: 24 },
  { chunk_id: "MAIN_14", category: "Mains", name: "Gemista", description: "Tomatoes and peppers stuffed with herbed rice, baked slowly. A traditional plate, served warm or at room temperature.", price: 20 },
  { chunk_id: "DESSERT_01", category: "Desserts", name: "Baklava", description: "Layered phyllo with walnuts and orange-blossom honey syrup.", ingredients: "Phyllo, walnuts, orange-blossom honey, butter, cinnamon", price: 9 },
  { chunk_id: "DESSERT_02", category: "Desserts", name: "Tiramisu", description: "Layers of mascarpone cream and espresso-soaked ladyfingers, dusted with cocoa.", price: 11 },
  { chunk_id: "DESSERT_03", category: "Desserts", name: "Dark chocolate torte", description: "Flourless dark chocolate torte with sea salt and crème fraîche.", price: 10 },
  { chunk_id: "DESSERT_04", category: "Desserts", name: "Greek yogurt with thyme honey & figs", description: "House-strained sheep's milk yogurt, wild thyme honey, and fresh figs.", ingredients: "Sheep's milk yogurt, wild thyme honey, fresh figs", price: 8 },
  { chunk_id: "DESSERT_05", category: "Desserts", name: "Loukoumades", description: "Honey-glazed Greek doughnuts with cinnamon and warm chocolate ganache for dipping.", price: 9 },
  { chunk_id: "WINE_01", category: "Wines", name: "Assyrtiko", description: "Santorini, 2022. Glass 14, bottle 52.", region: "Santorini", varietal: "Assyrtiko", vintage: 2022, price_glass: 14, price_bottle: 52 },
  { chunk_id: "WINE_02", category: "Wines", name: "Moschofilero", description: "Mantinia, 2023. Glass 12, bottle 44.", region: "Mantinia", varietal: "Moschofilero", vintage: 2023, price_glass: 12, price_bottle: 44 },
  { chunk_id: "WINE_03", category: "Wines", name: "Malagousia", description: "Drama, 2022. Glass 13, bottle 48.", region: "Drama", varietal: "Malagousia", vintage: 2022, price_glass: 13, price_bottle: 48 },
  { chunk_id: "WINE_04", category: "Wines", name: "Agiorgitiko", description: "Nemea, 2021. Glass 14, bottle 52.", region: "Nemea", varietal: "Agiorgitiko", vintage: 2021, price_glass: 14, price_bottle: 52 },
  { chunk_id: "WINE_05", category: "Wines", name: "Xinomavro", description: "Naoussa, 2020. Glass 16, bottle 58.", region: "Naoussa", varietal: "Xinomavro", vintage: 2020, price_glass: 16, price_bottle: 58 },
  { chunk_id: "WINE_06", category: "Wines", name: "Naoussa Reserve", description: "Naoussa, 2019. Glass 18, bottle 68.", region: "Naoussa", varietal: "Xinomavro Reserve", vintage: 2019, price_glass: 18, price_bottle: 68 },
  { chunk_id: "WINE_07", category: "Wines", name: "Retsina", description: "Attica, 2023. Glass 10, bottle 36.", region: "Attica", varietal: "Savatiano with Aleppo pine resin", vintage: 2023, price_glass: 10, price_bottle: 36 },
  { chunk_id: "WINE_08", category: "Wines", name: "Vinsanto", description: "Santorini, 2018. Sweet, sun-dried Assyrtiko. Glass 12, half-bottle 54.", region: "Santorini", varietal: "Sun-dried Assyrtiko", vintage: 2018, price_glass: 12, price_half_bottle: 54 },
  { chunk_id: "COCKTAIL_01", category: "Cocktails", name: "Ouzo Spritz", description: "Ouzo, prosecco, soda, lemon twist.", ingredients: "Ouzo, prosecco, soda water, lemon", price: 14 },
  { chunk_id: "COCKTAIL_02", category: "Cocktails", name: "Mastiha Sour", description: "Mastiha liqueur, lemon juice, simple syrup, egg white.", ingredients: "Mastiha liqueur, lemon juice, simple syrup, egg white", price: 15 },
  { chunk_id: "COCKTAIL_03", category: "Cocktails", name: "Aegean Negroni", description: "Gin, mastiha, sweet vermouth, orange peel.", ingredients: "Gin, mastiha, sweet vermouth, orange peel", price: 16 },
  { chunk_id: "COCKTAIL_04", category: "Cocktails", name: "Cucumber Tzatziki Martini", description: "Vodka, cucumber, dill, yogurt foam.", ingredients: "Vodka, cucumber, dill, strained yogurt, lemon", price: 15 },
  { chunk_id: "COCKTAIL_05", category: "Cocktails", name: "Olive Leaf Old Fashioned", description: "Bourbon, olive leaf bitters, demerara, orange peel.", ingredients: "Bourbon, olive leaf bitters, demerara syrup, orange peel", price: 17 },
  { chunk_id: "COCKTAIL_06", category: "Cocktails", name: "Honey Basil Smash", description: "Vodka, thyme honey syrup, basil, lemon.", ingredients: "Vodka, thyme honey, basil leaves, lemon juice", price: 14 },
  { chunk_id: "COCKTAIL_07", category: "Cocktails", name: "Pomegranate Negroni", description: "Gin, Campari, sweet vermouth, pomegranate molasses.", ingredients: "Gin, Campari, sweet vermouth, pomegranate molasses, orange peel", price: 16 },
  { chunk_id: "COCKTAIL_08", category: "Cocktails", name: "Fig & Thyme Martini", description: "Gin, fig syrup, fresh thyme, lemon.", ingredients: "Gin, fig syrup, thyme, lemon", price: 15 }
];

function formatItem(item) {
  const lines = [`[${item.chunk_id}] ${item.name} (${item.category})`];
  if (item.description) lines.push(`  Description: ${item.description}`);
  if (item.ingredients) lines.push(`  Ingredients: ${item.ingredients}`);
  if (item.wine_pairing) lines.push(`  Wine pairing: ${item.wine_pairing}`);
  if (item.spice_level) lines.push(`  Spice level: ${item.spice_level}`);
  if (item.region) lines.push(`  Region: ${item.region}`);
  if (item.varietal) lines.push(`  Varietal: ${item.varietal}`);
  if (item.vintage) lines.push(`  Vintage: ${item.vintage}`);
  if (item.price !== undefined) lines.push(`  Price: $${item.price}`);
  if (item.price_glass !== undefined && item.price_bottle !== undefined) lines.push(`  Glass: $${item.price_glass}, Bottle: $${item.price_bottle}`);
  if (item.price_glass !== undefined && item.price_half_bottle !== undefined) lines.push(`  Glass: $${item.price_glass}, Half-bottle: $${item.price_half_bottle}`);
  return lines.join("\n");
}

const MENU_KB_FORMATTED = MENU_ITEMS.map(formatItem).join("\n\n");

// ─── Main batch-mode formatter logic, 3-input Merge structure ───

const items = $input.all();

if (items.length === 0) {
  throw new Error("output_formatter received zero items from Merge.");
}

if (items.length % 3 !== 0) {
  throw new Error(`Expected items.length divisible by 3 (baseline + augmented + metadata per question). Got ${items.length}. Check Merge node has 3 inputs in append mode.`);
}

const n = items.length / 3;
const baselines = items.slice(0, n);
const augmenteds = items.slice(n, 2 * n);
const metadatas = items.slice(2 * n, 3 * n);

const outputs = [];

for (let i = 0; i < n; i++) {
  const meta = metadatas[i].json;
  const a_response = baselines[i].json.output || baselines[i].json.text || baselines[i].json.response || '';
  const b_response = augmenteds[i].json.output || augmenteds[i].json.text || augmenteds[i].json.response || '';

  outputs.push({
    json: {
      run_id: meta.run_id,
      timestamp: meta.timestamp || new Date().toISOString(),
      question_id: meta.question_id,
      question_text: meta.question_text || meta.question,
      type: meta.type,
      restaurant: meta.restaurant || 'Eolia',
      a_response: a_response,
      b_response: b_response,
      menu_chunks_formatted: MENU_KB_FORMATTED
    }
  });
}

return outputs;
