import fs from 'node:fs';
import path from 'node:path';

const finiteMetric = (value, label) => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid critic metric ${label}: ${value}`);
  }
  return value;
};

export const scoreCriticMetrics = (metrics) => {
  let score = 0;
  if (metrics.secondsToFirstCombat <= 5) score += 20;
  if (metrics.secondsToFirstDrop <= 10) score += 20;
  if (metrics.ttkSeconds.level5 < metrics.ttkSeconds.level1) score += 20;
  if (metrics.meaningfulChoices.total >= 4) score += 20;
  if (metrics.deaths <= 1 && metrics.depthReached >= 4) score += 20;
  return score;
};

export const normalizeCriticMetrics = (metrics) => {
  if (!metrics || typeof metrics !== 'object') {
    throw new Error('Session critic metrics must be an object');
  }

  const normalized = {
    secondsToFirstCombat: finiteMetric(metrics.secondsToFirstCombat, 'secondsToFirstCombat'),
    secondsToFirstDrop: finiteMetric(metrics.secondsToFirstDrop, 'secondsToFirstDrop'),
    ttkSeconds: {
      level1: finiteMetric(metrics.ttkSeconds?.level1, 'ttkSeconds.level1'),
      level5: finiteMetric(metrics.ttkSeconds?.level5, 'ttkSeconds.level5'),
    },
    meaningfulChoices: {
      total: finiteMetric(metrics.meaningfulChoices?.total, 'meaningfulChoices.total'),
      treePoints: finiteMetric(metrics.meaningfulChoices?.treePoints, 'meaningfulChoices.treePoints'),
      equipSwaps: finiteMetric(metrics.meaningfulChoices?.equipSwaps, 'meaningfulChoices.equipSwaps'),
      zonePicks: finiteMetric(metrics.meaningfulChoices?.zonePicks, 'meaningfulChoices.zonePicks'),
    },
    deaths: finiteMetric(metrics.deaths, 'deaths'),
    depthReached: finiteMetric(metrics.depthReached, 'depthReached'),
  };

  return { ...normalized, criticScore: scoreCriticMetrics(normalized) };
};

const trendRow = (timestamp, scenario, metrics) => [
  timestamp,
  scenario,
  metrics.criticScore,
  metrics.secondsToFirstCombat,
  metrics.secondsToFirstDrop,
  metrics.ttkSeconds.level1,
  metrics.ttkSeconds.level5,
  metrics.meaningfulChoices.total,
  metrics.deaths,
  metrics.depthReached,
].join(' | ');

export const appendCriticMetrics = ({ projectRoot, scenario, metrics, timestamp = new Date() }) => {
  const journalPath = path.join(projectRoot, 'docs', 'loop-journal.md');
  const heading = '## Session-arc metric trends';
  const existing = fs.existsSync(journalPath) ? fs.readFileSync(journalPath, 'utf8') : '# Verdigris loop journal\n';
  const header = [
    heading,
    '',
    'UTC | Scenario | Score | First combat (s) | First drop (s) | TTK L1 (s) | TTK L5 (s) | Choices | Deaths | Depth',
    '--- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:',
  ].join('\n');
  const separator = existing.endsWith('\n') ? '\n' : '\n\n';
  const prefix = existing.includes(heading) ? '' : `${separator}${header}\n`;
  const row = `\n${trendRow(timestamp.toISOString(), scenario, metrics)}\n`;
  fs.appendFileSync(journalPath, `${prefix}${row}`);
};

export const recordCriticMetrics = ({ projectRoot, scenario, metrics, log }) => {
  const normalized = normalizeCriticMetrics(metrics);
  log('      METRICS');
  JSON.stringify(normalized, null, 2).split('\n').forEach(line => log(`      ${line}`));
  appendCriticMetrics({ projectRoot, scenario, metrics: normalized });
  return normalized;
};
