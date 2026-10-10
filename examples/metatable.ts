import { Lua } from "../src/main.ts";

/**
 * Demo: Lua Metatables, Object-Oriented Inheritance, and Operator Overloading.
 *
 * Metatables in Lua allow customizing table behaviors, including:
 * - Fallback property lookup (`__index`) for OOP inheritance.
 * - Operator overloading (`__add`, `__sub`, `__eq`, etc.).
 * - String formatting (`__tostring`).
 * - Custom call behavior (`__call`).
 */

export function runMetatableDemo() {
  const lua = Lua.full();

  console.log("=== 1. Operator Overloading with Metatables ===");

  // Define a 2D Vector class with __add and __tostring metamethods
  lua.eval(`
    Vector = {}
    Vector.__index = Vector

    function Vector.new(x, y)
      local self = setmetatable({}, Vector)
      self.x = x
      self.y = y
      return self
    end

    function Vector.__add(v1, v2)
      return Vector.new(v1.x + v2.x, v1.y + v2.y)
    end

    function Vector:__tostring()
      return "Vector(" .. self.x .. ", " .. self.y .. ")"
    end

    v1 = Vector.new(10, 20)
    v2 = Vector.new(5, 15)
    v3 = v1 + v2
  `);

  const v3X = lua.eval("return v3.x");
  const v3Y = lua.eval("return v3.y");
  const v3Str = lua.eval("return tostring(v3)");

  console.log(`v1 + v2 = Vector(${v3X}, ${v3Y})`);
  console.log(`v3 String Representation: ${v3Str}`);

  console.log("\n=== 2. Prototype Inheritance with Metatables ===");

  // Inheritance hierarchy: Animal -> Dog
  lua.eval(`
    Animal = { sound = "generic sound" }
    Animal.__index = Animal

    function Animal:new(name)
      local instance = setmetatable({ name = name }, self)
      return instance
    end

    function Animal:speak()
      return self.name .. " makes a " .. self.sound
    end

    Dog = Animal:new("DogPrototype")
    Dog.__index = Dog
    Dog.sound = "woof"

    function Dog:new(name, breed)
      local instance = Animal.new(Dog, name)
      instance.breed = breed
      return instance
    end

    myDog = Dog:new("Rex", "German Shepherd")
  `);

  const dogSpeak = lua.eval("return myDog:speak()");
  const dogBreed = lua.eval("return myDog.breed");

  console.log(`Dog Speech: ${dogSpeak}`);
  console.log(`Dog Breed: ${dogBreed}`);

  return {
    v3X,
    v3Y,
    v3Str,
    dogSpeak,
    dogBreed,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMetatableDemo();
}
