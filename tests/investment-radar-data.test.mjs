import assert from 'node:assert/strict';
import {
  AI_FRONTIER_THEMES,
  AI_HIERARCHY_STEPS,
  AI_INFRA_TICKERS,
  PORTFOLIO_OPTIONS,
  STARTUP_TRACKS,
  TICKER_DIRECTORY,
  getInvestableTickers,
  getThemeTickers,
  getUniqueUniverseTickers,
  validatePortfolioFramework,
} from '../src/data/investmentRadarData.js';

assert.equal(PORTFOLIO_OPTIONS.optionA.total, 500, 'Option A should total $500');
assert.equal(PORTFOLIO_OPTIONS.optionB.total, 500, 'Option B should total $500');
assert.deepEqual(getInvestableTickers().sort(), ['CEG', 'PLTR', 'SMH', 'VTI', 'XLE'].sort());
assert.ok(AI_INFRA_TICKERS.some((ticker) => ticker.symbol === 'NVDA' && ticker.track === 'signal'));
assert.equal(AI_HIERARCHY_STEPS.length, 8, 'Aschenbrenner hierarchy should have 8 layers');
assert.equal(AI_FRONTIER_THEMES.length, 8, 'Frontier universe should have 8 themes');
assert.ok(getUniqueUniverseTickers().length >= 60, 'Frontier universe should include 60+ unique tickers');
assert.equal(TICKER_DIRECTORY.BE.name, 'Bloom Energy');
assert.equal(TICKER_DIRECTORY.CRWV.sector, 'AI cloud / GPU infrastructure');
assert.deepEqual(getThemeTickers('power-energy').map((ticker) => ticker.symbol).slice(0, 3), ['BE', 'VST', 'CEG']);
assert.ok(STARTUP_TRACKS.every((idea) => idea.capitalAllocation === 0), 'Private ideas must not receive portfolio dollars');
assert.equal(validatePortfolioFramework().valid, true);
console.log('investment radar data contract ok');
