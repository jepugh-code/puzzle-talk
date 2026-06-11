/**
 * themes.js — curated theme packs for puzzle generation.
 *
 * Each theme has a name, an array of categories, and ordinal flags.
 * Categories[0] is always the "name" category (primary).
 * ordinal[i] = true means category i has a natural order (used for ordering clues).
 *
 * Item counts: themes support up to 5 items per category.
 * Generator slices to the needed count.
 */

export const THEMES = [
  {
    name: "Garden Club",
    categories: [
      { label: "Member",   items: ["Agnes", "Bette", "Clara", "Doris", "Eunice"] },
      { label: "Flower",   items: ["Rose", "Daisy", "Iris", "Lily", "Violet"] },
      { label: "Day",      items: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], ordinal: true },
      { label: "Tea",      items: ["Earl Grey", "Chamomile", "Peppermint", "Darjeeling", "Green Tea"] },
      { label: "Hat color",items: ["Red", "Blue", "Yellow", "Green", "Purple"] },
    ],
  },
  {
    name: "Grandkids",
    categories: [
      { label: "Grandchild", items: ["Anna", "Bobby", "Carla", "Danny", "Emma"] },
      { label: "Pet",        items: ["Dog", "Cat", "Bird", "Fish", "Rabbit"], article: true },
      { label: "Grade",      items: ["1st", "2nd", "3rd", "4th", "5th"], ordinal: true },
      { label: "Hobby",      items: ["Reading", "Drawing", "Soccer", "Piano", "Cooking"] },
      { label: "Snack",      items: ["Apple", "Crackers", "Yogurt", "Grapes", "Cheese"] },
    ],
  },
  {
    name: "Church Potluck",
    categories: [
      { label: "Neighbor",  items: ["Frances", "Grace", "Helen", "Irene", "Joyce"] },
      { label: "Dish",      items: ["Casserole", "Salad", "Pie", "Rolls", "Soup"] },
      { label: "Seat",      items: ["Table 1", "Table 2", "Table 3", "Table 4", "Table 5"], ordinal: true },
      { label: "Drink",     items: ["Lemonade", "Iced Tea", "Water", "Punch", "Coffee"] },
      { label: "Dessert",   items: ["Brownies", "Cookies", "Cake", "Pudding", "Cobbler"] },
    ],
  },
  {
    name: "Book Club",
    categories: [
      { label: "Reader",    items: ["Margaret", "Nancy", "Olive", "Patricia", "Ruth"] },
      { label: "Book",      items: ["Mystery", "Romance", "History", "Poetry", "Travel"] },
      { label: "Month",     items: ["January", "March", "May", "July", "September"], ordinal: true },
      { label: "Bookmark",  items: ["Ribbon", "Clip", "Card", "Leaf", "Photo"] },
      { label: "Chair",     items: ["Armchair", "Rocker", "Sofa", "Window seat", "Ottoman"] },
    ],
  },
  {
    name: "Street Neighbors",
    categories: [
      { label: "Neighbor",  items: ["Alice", "Ben", "Carol", "Dave", "Ellen"] },
      { label: "Pet",       items: ["Dog", "Cat", "Bird", "Fish", "Hamster"], article: true },
      { label: "House",     items: ["House 1", "House 2", "House 3", "House 4", "House 5"], ordinal: true },
      { label: "Color",     items: ["Red", "Blue", "Yellow", "Green", "White"] },
      { label: "Drink",     items: ["Coffee", "Tea", "Milk", "Juice", "Water"] },
    ],
  },
  {
    name: "Craft Fair",
    categories: [
      { label: "Crafter",   items: ["Beatrice", "Cecelia", "Dolores", "Elvira", "Faye"] },
      { label: "Craft",     items: ["Knitting", "Quilting", "Pottery", "Painting", "Weaving"] },
      { label: "Booth",     items: ["Booth 1", "Booth 2", "Booth 3", "Booth 4", "Booth 5"], ordinal: true },
      { label: "Color",     items: ["Pink", "Teal", "Gold", "Lavender", "Coral"] },
      { label: "Day",       items: ["Friday", "Saturday morning", "Saturday afternoon", "Sunday morning", "Sunday afternoon"], ordinal: true },
    ],
  },
  {
    name: "Bingo Night",
    categories: [
      { label: "Player",    items: ["Harriet", "Inez", "Jean", "Kathryn", "Louise"] },
      { label: "Lucky number", items: ["7", "11", "21", "42", "66"], ordinal: true },
      { label: "Dabber",    items: ["Red", "Blue", "Purple", "Green", "Orange"] },
      { label: "Snack",     items: ["Popcorn", "Pretzels", "Chips", "Candy", "Nuts"] },
      { label: "Seat",      items: ["Row 1", "Row 2", "Row 3", "Row 4", "Row 5"], ordinal: true },
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
    categories: cats.map(c => ({
      label: c.label,
      items: c.items.slice(0, numItems),
      ordinal: !!c.ordinal,
      article: !!c.article,
    })),
  };
}

export function themeCount() { return THEMES.length; }
