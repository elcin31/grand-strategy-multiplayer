import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldCountries, getWorldCountry, getWorldCapital, getWorldFlag, searchWorldCountries } from '../src/world/catalog';
test('world catalogue contains all 193 UN members and both observer states, including microstates', () => {
  assert.equal(worldCountries.length, 195);
  for (const id of ['germany','france','russia','usa','chn','ind','sds','psx','vat','nru','tuv','mco','smr','and','lie']) assert.ok(getWorldCountry(id), id);
  assert.equal(getWorldCountry('__proto__'), null);
  assert.equal(getWorldFlag('missing'), null);
});
test('every country has a linked capital, licensed offline SVG and immutable metadata', () => {
  const capitals = new Set<string>();
  const provinces = new Set<string>();
  for (const country of worldCountries) {
    const capital = getWorldCapital(country.id)!;
    assert.equal(capital.countryId, country.id);
    assert.ok(country.provinceIds.includes(capital.provinceId));
    assert.ok(!capitals.has(capital.id)); capitals.add(capital.id);
    assert.match(getWorldFlag(country.id)!, /<svg[\s>]/);
    assert.doesNotMatch(getWorldFlag(country.id)!, /<(script|foreignObject|image)[\s>]|https?:\/\/(?!www\.w3\.org)/i);
    for (const province of country.provinceIds) { assert.ok(!provinces.has(province)); provinces.add(province); }
    assert.ok(Object.isFrozen(country) && Object.isFrozen(country.provinceIds) && Object.isFrozen(country.neighbors));
    for (const neighbor of country.neighbors) {
      assert.ok(getWorldCountry(neighbor)!.neighbors.includes(country.id));
      assert.notEqual(country.color.toLowerCase(),getWorldCountry(neighbor)!.color.toLowerCase());
    }
  }
  assert.equal(provinces.size,4386);
  assert.equal(getWorldCapital('nru')!.capitalRole,'government-seat');
});
test('country picker search supports Russian names, English names and ISO codes', () => {
  assert.equal(searchWorldCountries('германия')[0]?.id,'germany');
  assert.equal(searchWorldCountries('south sudan')[0]?.id,'sds');
  assert.equal(searchWorldCountries('zzzzzz').length,0);
  assert.equal(searchWorldCountries('  ').length,worldCountries.length);
});
