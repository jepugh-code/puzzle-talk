/**
 * themes.js — curated theme packs for puzzle generation.
 *
 * Each theme has a name, a story intro, and an array of categories.
 * Categories[0] is always the "name" category (primary).
 *
 * Per non-name category, prose templates ("{}" is replaced by the item,
 * exactly as it appears on the grid):
 *   does    — "grows {}"                  → "Agnes grows the Rose."
 *   not     — "doesn't grow {}"           → "Agnes doesn't grow the Rose."
 *   before  — (ordinal categories only) "visits earlier in the week than"
 *
 * `who` is the friendly word for a person in this theme ("member", "neighbor").
 * ordinal: true means the category has a natural order (enables ordering clues).
 */

export const THEMES = [
  {
    name: "Garden Club",
    who: "member",
    intro: "The Garden Club met on a sunny spring morning. Each member tends a different flower, sips a different tea, and visits the garden on her own special day of the week. Can you sort out who does what?",
    categories: [
      { label: "Member",    items: ["Agnes", "Bette", "Clara", "Doris", "Eunice"] },
      { label: "Flower",    items: ["Rose", "Daisy", "Iris", "Lily", "Violet"],
        does: "grows the {}", not: "doesn't grow the {}" },
      { label: "Day",       items: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], ordinal: true,
        does: "visits on {}", not: "doesn't visit on {}",
        before: "visits earlier in the week than" },
      { label: "Tea",       items: ["Earl Grey", "Chamomile", "Peppermint", "Darjeeling", "Green Tea"],
        does: "drinks {}", not: "doesn't drink {}" },
      { label: "Hat color", items: ["Red", "Blue", "Yellow", "Green", "Purple"],
        does: "wears the {} hat", not: "doesn't wear the {} hat" },
    ],
  },
  {
    name: "Grandkids",
    who: "grandchild",
    intro: "All the grandkids came to visit this summer! Each one has a different pet, is in a different grade, and loves a different hobby. From the clues, can you match each grandchild to theirs?",
    categories: [
      { label: "Grandchild", items: ["Anna", "Bobby", "Carla", "Danny", "Emma"] },
      { label: "Pet",        items: ["Dog", "Cat", "Bird", "Fish", "Rabbit"],
        does: "has the {}", not: "doesn't have the {}" },
      { label: "Grade",      items: ["1st", "2nd", "3rd", "4th", "5th"], ordinal: true,
        does: "is in {} grade", not: "isn't in {} grade",
        before: "is in a lower grade than" },
      { label: "Hobby",      items: ["Reading", "Drawing", "Soccer", "Piano", "Cooking"],
        does: "loves {}", not: "doesn't love {}" },
      { label: "Snack",      items: ["Apples", "Crackers", "Yogurt", "Grapes", "Cheese"],
        does: "snacks on {}", not: "doesn't snack on {}" },
    ],
  },
  {
    name: "Church Potluck",
    who: "neighbor",
    intro: "Sunday's potluck was a wonderful spread! Each neighbor brought a different dish, sat at a different table, and poured a different drink. Who brought what — and where did they sit?",
    categories: [
      { label: "Neighbor",  items: ["Frances", "Grace", "Helen", "Irene", "Joyce"] },
      { label: "Dish",      items: ["Casserole", "Salad", "Pie", "Rolls", "Soup"],
        does: "brought the {}", not: "didn't bring the {}" },
      { label: "Table",     items: ["Table 1", "Table 2", "Table 3", "Table 4", "Table 5"], ordinal: true,
        does: "sat at {}", not: "didn't sit at {}",
        before: "sat at a lower-numbered table than" },
      { label: "Drink",     items: ["Lemonade", "Iced Tea", "Water", "Punch", "Coffee"],
        does: "drank {}", not: "didn't drink {}" },
      { label: "Dessert",   items: ["Brownies", "Cookies", "Cake", "Pudding", "Cobbler"],
        does: "had the {}", not: "didn't have the {}" },
    ],
  },
  {
    name: "Book Club",
    who: "reader",
    intro: "The book club is picking favorites again. Each reader champions a different kind of book, hosts in a different month, and has her own favorite chair. Use the clues to put it all together.",
    categories: [
      { label: "Reader",    items: ["Margaret", "Nancy", "Olive", "Patricia", "Ruth"] },
      { label: "Book",      items: ["Mystery", "Romance", "History", "Poetry", "Travel"],
        does: "loves {} books", not: "doesn't love {} books" },
      { label: "Month",     items: ["January", "March", "May", "July", "September"], ordinal: true,
        does: "hosts in {}", not: "doesn't host in {}",
        before: "hosts earlier in the year than" },
      { label: "Bookmark",  items: ["Ribbon", "Clip", "Card", "Leaf", "Photo"],
        does: "marks her page with the {}", not: "doesn't use the {}" },
      { label: "Chair",     items: ["Armchair", "Rocker", "Sofa", "Window seat", "Ottoman"],
        does: "sits in the {}", not: "doesn't sit in the {}" },
    ],
  },
  {
    name: "Street Neighbors",
    who: "neighbor",
    intro: "The houses stand in a neat row on Maple Street, and the neighbors are a friendly bunch. Each one keeps a different pet, lives in a different house, and starts the day with a different drink. Can you work out who lives where?",
    categories: [
      { label: "Neighbor",  items: ["Alice", "Ben", "Carol", "Dave", "Ellen"] },
      { label: "Pet",       items: ["Dog", "Cat", "Bird", "Fish", "Hamster"],
        does: "keeps the {}", not: "doesn't keep the {}" },
      { label: "House",     items: ["House 1", "House 2", "House 3", "House 4", "House 5"], ordinal: true,
        does: "lives in {}", not: "doesn't live in {}",
        before: "lives in a lower-numbered house than" },
      { label: "Color",     items: ["Red", "Blue", "Yellow", "Green", "White"],
        does: "has the {} front door", not: "doesn't have the {} front door" },
      { label: "Drink",     items: ["Coffee", "Tea", "Milk", "Juice", "Water"],
        does: "drinks {} at breakfast", not: "doesn't drink {} at breakfast" },
    ],
  },
  {
    name: "Craft Fair",
    who: "crafter",
    intro: "The spring craft fair is buzzing! Each crafter shows a different craft at a different booth, each with her own signature color. Match each crafter to her craft, booth, and color.",
    categories: [
      { label: "Crafter",   items: ["Beatrice", "Cecelia", "Dolores", "Elvira", "Faye"] },
      { label: "Craft",     items: ["Knitting", "Quilting", "Pottery", "Painting", "Weaving"],
        does: "does {}", not: "doesn't do {}" },
      { label: "Booth",     items: ["Booth 1", "Booth 2", "Booth 3", "Booth 4", "Booth 5"], ordinal: true,
        does: "is at {}", not: "isn't at {}",
        before: "is at a lower-numbered booth than" },
      { label: "Color",     items: ["Pink", "Teal", "Gold", "Lavender", "Coral"],
        does: "decorates in {}", not: "doesn't decorate in {}" },
    ],
  },
  {
    name: "Bingo Night",
    who: "player",
    intro: "It's Friday bingo night at the community hall! Each player has a lucky number, a favorite dabber color, and a go-to snack. The clues will tell you who's who.",
    categories: [
      { label: "Player",    items: ["Harriet", "Inez", "Jean", "Kathryn", "Louise"] },
      { label: "Number",    items: ["7", "11", "21", "42", "66"], ordinal: true,
        does: "plays lucky number {}", not: "doesn't play lucky number {}",
        before: "has a smaller lucky number than" },
      { label: "Dabber",    items: ["Red", "Blue", "Purple", "Green", "Orange"],
        does: "dabs with the {} dabber", not: "doesn't dab with the {} dabber" },
      { label: "Snack",     items: ["Popcorn", "Pretzels", "Chips", "Candy", "Nuts"],
        does: "munches on {}", not: "doesn't munch on {}" },
      { label: "Row",       items: ["Row 1", "Row 2", "Row 3", "Row 4", "Row 5"], ordinal: true,
        does: "sits in {}", not: "doesn't sit in {}",
        before: "sits in a lower row than" },
    ],
  },
  {
    name: "Farmers Market",
    who: "farmer",
    intro: "Saturday morning at the farmers market, and the stalls are full! Each farmer sells a different crop from a different stall, and each drove in from a different town. Can you sort out the market?",
    categories: [
      { label: "Farmer",    items: ["Walter", "Edith", "Homer", "Pearl", "Vernon"] },
      { label: "Crop",      items: ["Tomatoes", "Sweet corn", "Peaches", "Honey", "Pumpkins"],
        does: "sells {}", not: "doesn't sell {}" },
      { label: "Stall",     items: ["Stall 1", "Stall 2", "Stall 3", "Stall 4", "Stall 5"], ordinal: true,
        does: "is at {}", not: "isn't at {}",
        before: "is at a lower-numbered stall than" },
      { label: "Town",      items: ["Cedar Falls", "Maple Grove", "Fairview", "Riverside", "Oak Hill"],
        does: "drove in from {}", not: "didn't drive in from {}" },
      { label: "Truck",     items: ["Red", "Green", "Blue", "White", "Yellow"],
        does: "drives the {} truck", not: "doesn't drive the {} truck" },
    ],
  },
  {
    name: "Bird Watchers",
    who: "birder",
    intro: "The bird-watching club spread out along the nature trail at dawn. Each birder spotted a different bird at a different hour, using her own trusty pair of binoculars. Who saw what?",
    categories: [
      { label: "Birder",    items: ["Mabel", "Cora", "Stella", "Vera", "Hazel"] },
      { label: "Bird",      items: ["Cardinal", "Blue jay", "Owl", "Hummingbird", "Woodpecker"],
        does: "spotted the {}", not: "didn't spot the {}" },
      { label: "Time",      items: ["6 o'clock", "7 o'clock", "8 o'clock", "9 o'clock", "10 o'clock"], ordinal: true,
        does: "made her sighting at {}", not: "didn't make her sighting at {}",
        before: "spotted her bird earlier than" },
      { label: "Spot",      items: ["The pond", "The meadow", "The oak tree", "The feeder", "The bridge"],
        does: "was watching at {}", not: "wasn't watching at {}" },
      { label: "Snack",     items: ["Trail mix", "A muffin", "An orange", "Granola", "A thermos of cocoa"],
        does: "packed {}", not: "didn't pack {}" },
    ],
  },
  {
    name: "Bake Sale",
    who: "baker",
    intro: "The library bake sale is today, and the smell is heavenly! Each baker brought a different treat on a different platter, and each treat sold out at a different time. Use the clues to match them up.",
    categories: [
      { label: "Baker",     items: ["Opal", "Gladys", "Mildred", "Florence", "Lucille"] },
      { label: "Treat",     items: ["Apple pie", "Banana bread", "Sugar cookies", "Lemon bars", "Cinnamon rolls"],
        does: "baked the {}", not: "didn't bake the {}" },
      { label: "Platter",   items: ["Blue china", "Silver tray", "Wicker basket", "Glass dish", "Red tin"],
        does: "used the {}", not: "didn't use the {}" },
      { label: "Sold out",  items: ["9 a.m.", "10 a.m.", "11 a.m.", "Noon", "1 p.m."], ordinal: true,
        does: "sold out at {}", not: "didn't sell out at {}",
        before: "sold out earlier than" },
      { label: "Apron",     items: ["Polka dot", "Striped", "Floral", "Gingham", "Plain white"],
        does: "wore the {} apron", not: "didn't wear the {} apron" },
    ],
  },
  {
    name: "Quilting Bee",
    who: "quilter",
    intro: "The quilting bee gathered around the big frame on Thursday. Each quilter is piecing a different pattern in a different fabric, and each sits in her usual chair. Can you place everyone?",
    categories: [
      { label: "Quilter",   items: ["Esther", "Wilma", "Geneva", "Lorraine", "Bernice"] },
      { label: "Pattern",   items: ["Log cabin", "Star", "Pinwheel", "Nine patch", "Double ring"],
        does: "is piecing the {} pattern", not: "isn't piecing the {} pattern" },
      { label: "Fabric",    items: ["Calico", "Gingham", "Flannel", "Muslin", "Chintz"],
        does: "chose {}", not: "didn't choose {}" },
      { label: "Chair",     items: ["Chair 1", "Chair 2", "Chair 3", "Chair 4", "Chair 5"], ordinal: true,
        does: "sits in {}", not: "doesn't sit in {}",
        before: "sits in a lower-numbered chair than" },
      { label: "Thread",    items: ["White", "Navy", "Rose", "Gold", "Lavender"],
        does: "stitches with {} thread", not: "doesn't stitch with {} thread" },
    ],
  },
  {
    name: "Family Recipes",
    who: "cook",
    intro: "The family cookbook is getting a new chapter! Each cook is famous for a different dish, learned it from a different relative, and brings it to a different holiday. Sort out the family table.",
    categories: [
      { label: "Cook",      items: ["Rosemary", "Virginia", "Eleanor", "Dorothy", "Marian"] },
      { label: "Dish",      items: ["Pot roast", "Meatloaf", "Chicken soup", "Stuffing", "Fruit salad"],
        does: "is famous for the {}", not: "isn't famous for the {}" },
      { label: "Relative",  items: ["Grandma", "Aunt May", "Mother", "Cousin Lou", "Uncle Pete"],
        does: "learned it from {}", not: "didn't learn it from {}" },
      { label: "Holiday",   items: ["Easter", "The 4th of July", "Thanksgiving", "Christmas", "New Year's"], ordinal: true,
        does: "brings it at {}", not: "doesn't bring it at {}",
        before: "cooks for an earlier holiday than" },
      { label: "Secret",    items: ["Extra butter", "A pinch of nutmeg", "Fresh herbs", "Brown sugar", "Lemon zest"],
        does: "swears by {}", not: "doesn't swear by {}" },
    ],
  },
  {
    name: "Choir Practice",
    who: "singer",
    intro: "Wednesday night choir practice is in full voice! Each singer holds a different part, stands in a different row, and has a favorite hymn she always requests. Who sings what?",
    categories: [
      { label: "Singer",    items: ["Phyllis", "Norma", "Arlene", "June", "Betty"] },
      { label: "Part",      items: ["Soprano", "Alto", "Tenor", "Descant", "Harmony"],
        does: "sings {}", not: "doesn't sing {}" },
      { label: "Row",       items: ["Row 1", "Row 2", "Row 3", "Row 4", "Row 5"], ordinal: true,
        does: "stands in {}", not: "doesn't stand in {}",
        before: "stands in a lower row than" },
      { label: "Hymn",      items: ["Amazing Grace", "How Great Thou Art", "In the Garden", "Blessed Assurance", "Sweet By and By"],
        does: "always requests {}", not: "doesn't request {}" },
      { label: "Folder",    items: ["Red", "Blue", "Green", "Black", "Brown"],
        does: "carries the {} folder", not: "doesn't carry the {} folder" },
    ],
  },
  {
    name: "Lake Cabin Week",
    who: "cousin",
    intro: "The whole family rented cabins by the lake for a week! Each cousin stays in a different cabin, loves a different lake activity, and claims a different evening for cooking dinner. Piece the week together.",
    categories: [
      { label: "Cousin",    items: ["Roger", "Janet", "Phil", "Connie", "Stan"] },
      { label: "Cabin",     items: ["Cabin 1", "Cabin 2", "Cabin 3", "Cabin 4", "Cabin 5"], ordinal: true,
        does: "stays in {}", not: "doesn't stay in {}",
        before: "stays in a lower-numbered cabin than" },
      { label: "Activity",  items: ["Fishing", "Canoeing", "Swimming", "Birdwatching", "Reading on the dock"],
        does: "loves {}", not: "doesn't love {}" },
      { label: "Dinner",    items: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], ordinal: true,
        does: "cooks dinner on {}", not: "doesn't cook dinner on {}",
        before: "cooks on an earlier night than" },
      { label: "Hat",       items: ["Straw", "Baseball", "Bucket", "Visor", "Bandana"],
        does: "wears the {} hat", not: "doesn't wear the {} hat" },
    ],
  },
];

/**
 * Return a theme object with categories sliced to numItems items each.
 * Only categories that have enough items are included; caller picks numCategories of them.
 */
export function getTheme(themeIndex, numCategories, numItems) {
  const theme = THEMES[themeIndex % THEMES.length];
  const cats = theme.categories
    .filter(c => c.items.length >= numItems)
    .slice(0, numCategories);
  return {
    name: theme.name,
    who: theme.who,
    intro: theme.intro,
    categories: cats.map(c => ({
      label: c.label,
      items: c.items.slice(0, numItems),
      ordinal: !!c.ordinal,
      does: c.does || null,
      not: c.not || null,
      before: c.before || null,
    })),
  };
}

export function themeCount() { return THEMES.length; }

const DEFAULT_GRANDKIDS = ["Anna", "Bobby", "Carla", "Danny", "Emma"];

/**
 * Replace the Grandkids names with the player's real family names.
 * Fewer than 5 names are padded with defaults; duplicates are dropped
 * (duplicate names would break voice matching). Applies to puzzles
 * generated after the call.
 */
export function setFamilyNames(names) {
  const t = THEMES.find(x => x.name === 'Grandkids');
  const seen = new Set();
  const clean = (names || [])
    .map(n => String(n).trim())
    .filter(n => n.length > 0 && /^[A-Za-z][A-Za-z .'-]*$/.test(n))
    .filter(n => { const k = n.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 5);
  const padded = [...clean];
  for (const d of DEFAULT_GRANDKIDS) {
    if (padded.length >= 5) break;
    if (!seen.has(d.toLowerCase())) { padded.push(d); seen.add(d.toLowerCase()); }
  }
  t.categories[0].items = padded;
  return clean;
}
