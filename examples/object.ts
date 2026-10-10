import { Lua } from "../src/main.ts";

/**
 * Demo: Defining and manipulating a Lua object from a TS/JS object using NAPI.
 *
 * Question: Can we define a Lua object from TS using NAPI?
 * Answer: Yes! TypeScript/JavaScript objects (including nested objects and arrays)
 * are passed across the NAPI boundary into the Lua VM using `lua.setGlobal(name, object)`.
 * The NAPI binding converts JS plain objects to Lua tables with key-value pairs,
 * and JS arrays to 1-indexed Lua tables.
 */

// 1. Define a TypeScript interface and object
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
}

const initialPlayer: Player = {
  name: "Aria",
  role: "Mage",
  stats: {
    health: 100,
    mana: 150,
    level: 1,
  },
  inventory: ["Staff", "Health Potion"],
};

export function runDemo() {
  // Initialize Lua VM
  const lua = Lua.full();

  console.log("=== 1. Pass TS Object to Lua VM ===");
  // Pass TS object to Lua global scope using NAPI
  lua.setGlobal("player", initialPlayer);

  // Read properties from Lua
  const name = lua.eval("return player.name");
  const hp = lua.eval("return player.stats.health");
  const firstItem = lua.eval("return player.inventory[1]"); // 1-indexed in Lua

  console.log(`Player Name: ${name}`);
  console.log(`Player HP: ${hp}`);
  console.log(`First Inventory Item: ${firstItem}`);

  console.log("\n=== 2. Modify Object inside Lua ===");
  // Modify properties and manipulate arrays/tables inside Lua
  lua.eval(`
    player.stats.health = player.stats.health - 25
    player.stats.mana = player.stats.mana - 10
    player.score = 150
    table.insert(player.inventory, "Mana Potion")
  `);

  // Retrieve updated object back into TypeScript
  const updatedPlayer = lua.getGlobal("player") as Player & { score: number };
  console.log("Updated Player in TS:", updatedPlayer);

  console.log("\n=== 3. Add Object Methods/Behavior in Lua ===");
  // Attach methods to the Lua table to give it Object-Oriented behavior
  lua.eval(`
    function player:heal(amount)
      self.stats.health = self.stats.health + amount
    end

    function player:takeDamage(amount)
      self.stats.health = math.max(0, self.stats.health - amount)
    end
  `);

  // Call methods on the Lua object
  lua.eval("player:heal(15)");
  const hpAfterHeal = lua.eval("return player.stats.health");
  console.log(`Player HP after heal: ${hpAfterHeal}`);

  lua.eval("player:takeDamage(50)");
  const hpAfterDamage = lua.eval("return player.stats.health");
  console.log(`Player HP after damage: ${hpAfterDamage}`);

  return updatedPlayer;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo();
}
