// Enhetstester för det som delas mellan server och klient: inställningar, banor och rörelse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANIMALS, ANIMAL_IDS, COLORS, TEAM_COUNT, WEAPONS } from '../shared/constants.js';
import { BASES, MAPS, baseSpawn, createMap, groundHeight, inBase, inPond, mapInfo, POND } from '../shared/map.js';
import { createMover, inStink, stepMover } from '../shared/movement.js';

test('alla djur har de värden rörelsen behöver', () => {
  assert.equal(ANIMAL_IDS.length, 8);
  for (const id of ANIMAL_IDS) {
    const a = ANIMALS[id];
    for (const key of ['name', 'speed', 'jump', 'swim', 'ability']) assert.ok(a[key] !== undefined, `${id} saknar ${key}`);
    assert.ok(a.speed > 0 && a.jump > 0, `${id} måste kunna gå och hoppa`);
  }
});

test('vapnen har rimliga värden och första vapnet är gratis', () => {
  assert.equal(WEAPONS[0].price, 0);
  for (const w of WEAPONS) {
    assert.ok(w.name, 'vapen saknar namn');
    assert.ok(w.price >= 0 && w.rate > 0 && w.damage > 0 && w.range > 0, `${w.name} har konstiga värden`);
  }
});

test('ett lag per färg och en bas per lag', () => {
  assert.equal(TEAM_COUNT, COLORS.length);
  assert.ok(BASES.length >= TEAM_COUNT);
});

test('okänd bana ger första banan', () => {
  assert.equal(mapInfo('finns-inte').id, MAPS[0].id);
});

for (const { id } of MAPS) {
  test(`banan ${id} byggs likadant varje gång`, () => {
    const a = createMap(id);
    const b = createMap(id);
    assert.ok(a.boxes.length > 0, 'banan har inga lådor');
    assert.equal(a.hash, b.hash, 'samma bana måste ge samma fingeravtryck på server och klient');
  });

  test(`banan ${id}: baserna är fria att stå i`, () => {
    const map = createMap(id);
    for (let i = 0; i < BASES.length; i++) {
      const s = baseSpawn(i);
      assert.equal(inBase(s.x, s.z), i, `startpunkten för bas ${i} ligger inte i basen`);
      assert.ok(groundHeight(map, s.x, s.z, 5) < 0.7, `något står i vägen i bas ${i}`);
    }
  });
}

test('banorna har olika fingeravtryck', () => {
  const hashes = new Set(MAPS.map((m) => createMap(m.id).hash));
  assert.equal(hashes.size, MAPS.length);
});

test('dammen räknas som damm', () => {
  assert.ok(inPond((POND.x0 + POND.x1) / 2, (POND.z0 + POND.z1) / 2));
  assert.ok(!inPond(-30, 30));
});

test('ett djur går framåt, hoppar och landar igen', () => {
  const map = createMap('park');
  const m = createMover(BASES[0].x, 0, BASES[0].z, ANIMAL_IDS[0]);
  for (let i = 0; i < 10; i++) stepMover(m, { mx: 1, mz: 0, jump: false, jumpHeld: false }, 0.05, map);
  assert.ok(m.x > BASES[0].x, 'djuret rörde sig inte');
  stepMover(m, { mx: 0, mz: 0, jump: true, jumpHeld: true }, 0.05, map);
  assert.ok(m.y > 0 && !m.onGround, 'djuret hoppade inte');
  for (let i = 0; i < 100; i++) stepMover(m, { mx: 0, mz: 0, jump: false, jumpHeld: false }, 0.05, map);
  assert.ok(m.onGround, 'djuret landade inte');
  assert.ok(Number.isFinite(m.x) && Number.isFinite(m.y) && Number.isFinite(m.z));
});

test('i ett stinkmoln går man långsammare', () => {
  const map = createMap('park');
  const walk = (slow) => {
    const m = createMover(BASES[0].x, 0, BASES[0].z, 'fox');
    m.slow = slow;
    for (let i = 0; i < 10; i++) stepMover(m, { mx: 1, mz: 0, jump: false, jumpHeld: false }, 0.05, map);
    return m.x - BASES[0].x;
  };
  assert.ok(walk(true) < walk(false) * 0.75);
});

test('stinkmolnet gäller bara andra lag och bara nära', () => {
  const clouds = [[0, 0, 0, 1]];
  assert.ok(inStink(clouds, 0, 1, 0, 1), 'motståndare nära molnet ska bli långsam');
  assert.ok(!inStink(clouds, 1, 1, 0, 1), 'skunkens eget lag ska inte bli långsamt');
  assert.ok(!inStink(clouds, 0, 10, 0, 0), 'långt bort ska inte räknas');
  assert.ok(!inStink([], 0, 0, 0, 0));
});
