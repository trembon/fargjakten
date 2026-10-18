// Gemensamma inställningar för server och klient.

export const PORT = 4321;
export const TICK_RATE = 20; // server-uppdateringar per sekund
export const WIN_SCORE = 10; // första laget till 10 plask vinner rundan
export const INTERMISSION_SECONDS = 8;
export const PAINT_MAX = 100;
export const MAX_PLAYERS = 8;
export const MAX_FOOD = 28;
export const SPAWN_PROTECT = 2.5; // sekunder skydd efter plask
export const SCORE_PLASK = 1; // poäng bara när man plaskar någon
export const WASH_RATE = 20; // så mycket färg som tvättas bort per sekund i dammen

// Fyra lag – färgen man väljer bestämmer laget. Index = bas i shared/map.js.
export const COLORS = [
  { id: "red", hex: 0xff3b3b, name: "Röd", team: "Röda laget", emoji: "🔴" },
  { id: "blue", hex: 0x3b7bff, name: "Blå", team: "Blå laget", emoji: "🔵" },
  { id: "yellow", hex: 0xffd21f, name: "Gul", team: "Gula laget", emoji: "🟡" },
  {
    id: "green",
    hex: 0x2fd35a,
    name: "Grön",
    team: "Gröna laget",
    emoji: "🟢",
  },
];
export const TEAM_COUNT = COLORS.length;

export const ANIMALS = {
  capybara: {
    name: "Capybara",
    speed: 6.2,
    jump: 8.5,
    toughness: 0.7, // tar mindre färg
    doubleJump: false,
    swim: 1.35,
    ability: "shield",
    abilityName: "Sköld",
    duration: 3,
    cooldown: 12,
    desc: "Tålig och snabbast i vatten. ★ = Sköld",
  },
  eagle: {
    name: "Örn",
    speed: 6.4,
    jump: 8.5,
    toughness: 1.0,
    doubleJump: false,
    glide: true, // håll in hopp i luften för att sväva
    swim: 0.5,
    ability: "fly",
    abilityName: "Flyg",
    duration: 3.5,
    cooldown: 8,
    desc: "Kan sväva och flyga högt. ★ = Flyg",
  },
  monkey: {
    name: "Apa",
    speed: 7.4,
    jump: 9,
    toughness: 1.0,
    doubleJump: true,
    swim: 0.55,
    ability: "sprint",
    abilityName: "Spurt",
    duration: 3,
    cooldown: 10,
    desc: "Snabb och kan dubbelhoppa. ★ = Spurt",
  },
  chameleon: {
    name: "Kameleont",
    speed: 6.6,
    jump: 8.5,
    toughness: 0.9,
    doubleJump: false,
    swim: 0.6,
    ability: "hide",
    abilityName: "Osynlig",
    duration: 5,
    cooldown: 14,
    desc: "Kan bli nästan osynlig. ★ = Osynlig",
  },
  redpanda: {
    name: "Röd panda",
    speed: 6.8,
    jump: 8.5,
    toughness: 1.0,
    doubleJump: false,
    swim: 0.6,
    ability: "roll",
    abilityName: "Rulla",
    duration: 3,
    cooldown: 11,
    desc: "Rullar ihop sig till en snabb boll som tar halva färgen. ★ = Rulla",
  },
  rabbit: {
    name: "Kanin",
    speed: 7.0,
    jump: 10.5, // hoppar lite högre än de andra hela tiden
    toughness: 1.05,
    doubleJump: false,
    swim: 0.5,
    ability: "superjump",
    abilityName: "Superhopp",
    duration: 4,
    cooldown: 10,
    desc: "Hoppar högt – och jättehögt med superhopp. ★ = Superhopp",
  },
};

export const ANIMAL_IDS = Object.keys(ANIMALS);

// Skotten tar aldrig slut – vapnen skiljer sig i takt, skada, form och räckvidd (meter).
export const WEAPONS = [
  {
    name: "Vattenpistol",
    price: 0,
    rate: 3.4,
    damage: 12,
    speed: 24,
    gravity: 8,
    count: 1,
    spread: 0,
    size: 0.22,
    splash: 0,
    range: 18,
  },
  {
    name: "Färgblaster",
    price: 25,
    rate: 6.8,
    damage: 10,
    speed: 28,
    gravity: 6,
    count: 1,
    spread: 0.02,
    size: 0.22,
    splash: 0,
    range: 20,
  },
  {
    name: "Regnbågskanon",
    price: 60,
    rate: 2.1,
    damage: 9,
    speed: 24,
    gravity: 8,
    count: 5,
    spread: 0.09,
    size: 0.2,
    splash: 0,
    range: 16,
    rainbow: true,
  },
  {
    name: "Färgbazooka",
    price: 60,
    rate: 1.0,
    damage: 40,
    speed: 20,
    gravity: 10,
    count: 1,
    spread: 0,
    size: 0.45,
    splash: 3.2,
    range: 22,
  },
  {
    name: "Superslangen",
    price: 100,
    rate: 10,
    damage: 9,
    speed: 34,
    gravity: 3,
    count: 1,
    spread: 0.015,
    size: 0.24,
    splash: 1.0,
    range: 26,
  },
];

export const FOODS = [
  { id: "apple", name: "Äpple", value: 1, weight: 5 },
  { id: "carrot", name: "Morot", value: 1, weight: 4 },
  { id: "banana", name: "Banan", value: 2, weight: 3 },
  { id: "cake", name: "Tårta", value: 5, weight: 1 },
];

export const BOT_NAMES = [
  "Robo-Rut",
  "Bot-Bosse",
  "Pixel-Pelle",
  "Klump-Klara",
  "Dator-Dino",
  "Kladd-Kalle",
];
