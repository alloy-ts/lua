import { Lua } from "../src/main.ts";

/**
 * Interface representing a player object in TypeScript.
 */
interface PlayerStats {
  health: number;
  mana: number;
  level: number;
}

interface Player {
  name: string;
  role: string;
  stats: PlayerStats;
  inventory: string[];
  active: boolean;
}

export function runObjectExample(): Player {
  // 1. Initialize a full Lua VM state
  const lua = Lua.full();

  // 2. Define a TypeScript object
  const initialPlayer: Player = {
    name: "Aria",
    role: "Mage",
    stats: {
      health: 100,
      mana: 250,
      level: 5,
    },
    inventory: ["Staff of Light", "Health Potion", "Mana Potion"],
    active: true,
  };

  console.log("Initial TS Player Object:", initialPlayer);

  // 3. Define the Lua object from TS by setting it as a global variable.
  // Under the hood, NAPI converts JS objects to Lua tables recursively:
  // - Plain TS/JS objects become keyed Lua tables.
  // - JS arrays become 1-indexed sequential Lua tables.
  lua.setGlobal("player", initialPlayer);

  // 4. Access object properties in Lua scripts
  const greeting = lua.eval(
    "return 'Player ' .. player.name .. ' (' .. player.role .. ') is Level ' .. player.stats.level",
  ) as string;
  console.log("Lua evaluation output:", greeting);

  // 5. Mutate the object properties inside Lua
  // We can modify fields, append to arrays (using Lua's 1-indexed # operator), and add new fields.
  lua.eval(`
    player.stats.health = player.stats.health - 20
    player.stats.level = player.stats.level + 1
    table.insert(player.inventory, "Spellbook")
    player.title = "Archmage"
  `);

  // 6. Retrieve the updated object back from Lua into TypeScript
  const updatedPlayer = lua.getGlobal("player") as Player & { title?: string };
  console.log("Updated Player Object from Lua:", updatedPlayer);

  return updatedPlayer as Player;
}

// Execute the example if run directly
if (
  typeof process !== "undefined" &&
  process.argv &&
  import.meta.url === `file://${process.argv[1]}`
) {
  runObjectExample();
}
