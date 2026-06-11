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
