function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function randomChoice(arr) {
  return arr[randomInt(0, arr.length)];
}

function randomSample(arr, k) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, k);
}

function createEmptyGrid(days, slots) {
  return Array.from({ length: days }, () => Array(slots).fill(null));
}

function cloneGrid(grid) {
  return grid.map(row => [...row]);
}

function buildSub2Prof(professors) {
  const map = {};
  for (const p of professors) {
    for (const sid of p.subject_ids) {
      map[sid] = p.id;
    }
  }
  return map;
}

function buildBlocked(professors) {
  const map = {};
  for (const p of professors) {
    map[p.id] = new Set((p.unavailable || []).map(([d, s]) => `${d},${s}`));
  }
  return map;
}

function fillGroup(grid, group, subjects, sub2prof, blocked, days, slots) {
  const subHours = {};
  for (const sid of group.subject_ids) {
    subHours[sid] = (subHours[sid] || 0) + (subjects[sid]?.hours_per_week ?? 5);
  }

  const sessions = [];
  for (const [sid, total] of Object.entries(subHours)) {
    let remaining = total;
    while (remaining > 0) {
      let dur = 1;
      if (remaining >= 2) dur = Math.random() < 0.5 ? 1 : 2;
      sessions.push([sid, Math.min(dur, remaining)]);
      remaining -= dur;
    }
  }

  for (let i = sessions.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [sessions[i], sessions[j]] = [sessions[j], sessions[i]];
  }

  const subjectDays = {};

  for (const [sid, dur] of sessions) {
    if (!subjectDays[sid]) subjectDays[sid] = new Set();
    let placed = false;

    const candidates = [];
    for (let d = 0; d < days; d++) {
      for (let s = 0; s <= slots - dur; s++) {
        candidates.push([d, s]);
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1);
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    for (const [d, s] of candidates) {
      if (subjectDays[sid].has(d)) continue;
      let ok = true;
      for (let i = 0; i < dur; i++) {
        if (grid[d][s + i] !== null) { ok = false; break; }
      }
      if (!ok) continue;
      const pid = sub2prof[sid];
      if (pid) {
        for (let i = 0; i < dur; i++) {
          if (blocked[pid]?.has(`${d},${s + i}`)) { ok = false; break; }
        }
      }
      if (!ok) continue;
      for (let i = 0; i < dur; i++) grid[d][s + i] = sid;
      subjectDays[sid].add(d);
      placed = true;
      break;
    }

    if (!placed) {
      outer: for (let d = 0; d < days; d++) {
        for (let s = 0; s <= slots - dur; s++) {
          let ok = true;
          for (let i = 0; i < dur; i++) {
            if (grid[d][s + i] !== null) { ok = false; break; }
          }
          if (ok) {
            for (let i = 0; i < dur; i++) grid[d][s + i] = sid;
            subjectDays[sid].add(d);
            placed = true;
            break outer;
          }
        }
      }
    }

    if (!placed) {
      outer2: for (let d = 0; d < days; d++) {
        for (let s = 0; s < slots; s++) {
          if (grid[d][s] === null) {
            grid[d][s] = sid;
            placed = true;
            break outer2;
          }
        }
      }
    }
  }
}

function randomSchedule(groups, subjects, sub2prof, blocked, days, slots) {
  const grid = {};
  for (const g of groups) {
    grid[g.id] = createEmptyGrid(days, slots);
    fillGroup(grid[g.id], g, subjects, sub2prof, blocked, days, slots);
  }
  return { grid, fitness: 0, details: {} };
}

function cloneSchedule(sched) {
  const grid = {};
  for (const [gid, g] of Object.entries(sched.grid)) {
    grid[gid] = cloneGrid(g);
  }
  return { grid, fitness: sched.fitness, details: { ...sched.details } };
}

function profConflicts(grid, groups, days, slots, sub2prof) {
  const slotUse = {};
  for (const g of groups) {
    for (let d = 0; d < days; d++) {
      for (let s = 0; s < slots; s++) {
        const sid = grid[g.id][d][s];
        if (sid) {
          const pid = sub2prof[sid];
          if (pid) {
            const k = `${d},${s},${pid}`;
            slotUse[k] = (slotUse[k] || 0) + 1;
          }
        }
      }
    }
  }
  return Object.values(slotUse).reduce((acc, v) => acc + Math.max(0, v - 1), 0);
}

function availViolations(grid, groups, days, slots, sub2prof, blocked) {
  let v = 0;
  for (const g of groups) {
    for (let d = 0; d < days; d++) {
      for (let s = 0; s < slots; s++) {
        const sid = grid[g.id][d][s];
        if (sid) {
          const pid = sub2prof[sid];
          if (pid && blocked[pid]?.has(`${d},${s}`)) v++;
        }
      }
    }
  }
  return v;
}

function studentGaps(grid, groups, days, slots) {
  let gaps = 0;
  for (const g of groups) {
    for (let d = 0; d < days; d++) {
      const row = grid[g.id][d];
      let first = -1, last = -1;
      for (let s = 0; s < slots; s++) if (row[s]) { if (first < 0) first = s; last = s; }
      if (first < 0) continue;
      for (let s = first; s <= last; s++) if (!row[s]) gaps++;
    }
  }
  return gaps;
}

function longSessions(grid, groups, days, slots) {
  let v = 0;
  for (const g of groups) {
    for (let d = 0; d < days; d++) {
      const row = grid[g.id][d];
      let run = 1;
      for (let s = 1; s < slots; s++) {
        if (row[s] && row[s] === row[s - 1]) { run++; if (run > 2) v++; }
        else run = 1;
      }
    }
  }
  return v;
}

function repeatedSubjectDay(grid, groups, days, slots) {
  let v = 0;
  for (const g of groups) {
    for (let d = 0; d < days; d++) {
      const row = grid[g.id][d];
      const seen = {};
      let prev = null;
      for (let s = 0; s < slots; s++) {
        const cur = row[s];
        if (cur && cur !== prev) seen[cur] = (seen[cur] || 0) + 1;
        prev = cur;
      }
      v += Object.values(seen).reduce((acc, c) => acc + Math.max(0, c - 1), 0);
    }
  }
  return v;
}

function dailyImbalance(grid, groups, days, slots) {
  let total = 0;
  for (const g of groups) {
    const hours = [];
    for (let d = 0; d < days; d++) {
      hours.push(grid[g.id][d].filter(Boolean).length);
    }
    const mu = hours.reduce((a, b) => a + b, 0) / hours.length;
    total += hours.reduce((acc, h) => acc + (h - mu) ** 2, 0) / hours.length;
  }
  return total;
}

function profDispersion(grid, groups, days, slots, sub2prof) {
  const pdays = {};
  for (const g of groups) {
    for (let d = 0; d < days; d++) {
      for (let s = 0; s < slots; s++) {
        const sid = grid[g.id][d][s];
        if (sid) {
          const pid = sub2prof[sid];
          if (pid) {
            if (!pdays[pid]) pdays[pid] = new Set();
            pdays[pid].add(d);
          }
        }
      }
    }
  }
  return Object.values(pdays).reduce((acc, ds) => acc + ds.size, 0);
}

function profGaps(grid, groups, days, slots, sub2prof) {
  const ps = {};
  for (const g of groups) {
    for (let d = 0; d < days; d++) {
      for (let s = 0; s < slots; s++) {
        const sid = grid[g.id][d][s];
        if (sid) {
          const pid = sub2prof[sid];
          if (pid) {
            if (!ps[pid]) ps[pid] = Array.from({ length: days }, () => Array(slots).fill(false));
            ps[pid][d][s] = true;
          }
        }
      }
    }
  }
  let gaps = 0;
  for (const pgrid of Object.values(ps)) {
    for (let d = 0; d < days; d++) {
      const row = pgrid[d];
      let first = -1, last = -1;
      for (let s = 0; s < slots; s++) if (row[s]) { if (first < 0) first = s; last = s; }
      if (first < 0) continue;
      for (let s = first; s <= last; s++) if (!row[s]) gaps++;
    }
  }
  return gaps;
}

function evaluate(sched, groups, days, slots, sub2prof, blocked) {
  let pen = 0;
  const det = {};
  const pc = profConflicts(sched.grid, groups, days, slots, sub2prof);
  pen += pc * 1000; det.prof_conflicts = pc;
  const av = availViolations(sched.grid, groups, days, slots, sub2prof, blocked);
  pen += av * 500; det.avail_violations = av;
  const sg = studentGaps(sched.grid, groups, days, slots);
  pen += sg * 10; det.student_gaps = sg;
  const ls = longSessions(sched.grid, groups, days, slots);
  pen += ls * 60; det.long_sessions = ls;
  const rs = repeatedSubjectDay(sched.grid, groups, days, slots);
  pen += rs * 35; det.repeated_subjects = rs;
  const di = dailyImbalance(sched.grid, groups, days, slots);
  pen += di * 5; det.imbalance = Math.round(di * 100) / 100;
  const pd = profDispersion(sched.grid, groups, days, slots, sub2prof);
  pen += pd * 8; det.prof_dispersion = pd;
  const pg = profGaps(sched.grid, groups, days, slots, sub2prof);
  pen += pg * 12; det.prof_gaps = pg;
  const fit = 1000.0 / (1.0 + pen);
  sched.fitness = fit;
  sched.details = det;
  return fit;
}

function tournament(pop, k) {
  const sample = randomSample(pop, Math.min(k, pop.length));
  return sample.reduce((best, x) => (x.fitness > best.fitness ? x : best));
}

function crossover(p1, p2, groups) {
  const c1 = cloneSchedule(p1);
  const c2 = cloneSchedule(p2);
  const gids = groups.map(g => g.id);
  if (gids.length >= 2) {
    const pt = randomInt(1, gids.length);
    for (let i = pt; i < gids.length; i++) {
      const gid = gids[i];
      c1.grid[gid] = cloneGrid(p2.grid[gid]);
      c2.grid[gid] = cloneGrid(p1.grid[gid]);
    }
  }
  return [c1, c2];
}

function mutate(sched, groups, subjects, sub2prof, blocked, days, slots, mutRate) {
  const m = cloneSchedule(sched);
  for (const g of groups) {
    if (Math.random() >= mutRate) continue;
    const grid = m.grid[g.id];
    const kind = randomChoice(['swap', 'move', 'day_swap', 'refill']);
    if (kind === 'swap') {
      const d1 = randomInt(0, days), s1 = randomInt(0, slots);
      const d2 = randomInt(0, days), s2 = randomInt(0, slots);
      [grid[d1][s1], grid[d2][s2]] = [grid[d2][s2], grid[d1][s1]];
    } else if (kind === 'move') {
      const filled = [], empty = [];
      for (let d = 0; d < days; d++) for (let s = 0; s < slots; s++) {
        if (grid[d][s]) filled.push([d, s]); else empty.push([d, s]);
      }
      if (filled.length && empty.length) {
        const [d1, s1] = randomChoice(filled);
        const [d2, s2] = randomChoice(empty);
        grid[d2][s2] = grid[d1][s1];
        grid[d1][s1] = null;
      }
    } else if (kind === 'day_swap') {
      const [d1, d2] = randomSample(Array.from({ length: days }, (_, i) => i), 2);
      [grid[d1], grid[d2]] = [[...grid[d2]], [...grid[d1]]];
    } else if (kind === 'refill') {
      m.grid[g.id] = createEmptyGrid(days, slots);
      fillGroup(m.grid[g.id], g, subjects, sub2prof, blocked, days, slots);
    }
  }
  return m;
}

export function runGA(config, onNewBest) {
  const { groups, subjects: subjectsList, professors, days = 5, slots = 8,
          pop_size = 100, generations = 300, mut_rate = 0.15, elite = 5, tourn_k = 3 } = config;

  const subjects = {};
  for (const s of subjectsList) subjects[s.id] = s;

  const sub2prof = buildSub2Prof(professors);
  const blocked  = buildBlocked(professors);

  let pop = Array.from({ length: pop_size }, () => {
    const sched = randomSchedule(groups, subjects, sub2prof, blocked, days, slots);
    evaluate(sched, groups, days, slots, sub2prof, blocked);
    return sched;
  });

  let bestEver = cloneSchedule(pop.reduce((b, x) => x.fitness > b.fitness ? x : b));
  const bestHist = [];
  const avgHist  = [];

  for (let gen = 0; gen < generations; gen++) {
    pop.sort((a, b) => b.fitness - a.fitness);
    const bf  = pop[0].fitness;
    const avg = pop.reduce((s, x) => s + x.fitness, 0) / pop.length;
    bestHist.push(bf);
    avgHist.push(avg);

    if (pop[0].fitness > bestEver.fitness) {
      bestEver = cloneSchedule(pop[0]);
      if (onNewBest) onNewBest(bestEver.fitness);
    }

    if (bf >= 990) break;

    const newPop = pop.slice(0, elite).map(cloneSchedule);

    while (newPop.length < pop_size) {
      const p1 = tournament(pop, tourn_k);
      const p2 = tournament(pop, tourn_k);
      let c1, c2;
      if (Math.random() < 0.80) {
        [c1, c2] = crossover(p1, p2, groups);
      } else {
        c1 = cloneSchedule(p1); c2 = cloneSchedule(p2);
      }
      evaluate(mutate(c1, groups, subjects, sub2prof, blocked, days, slots, mut_rate), groups, days, slots, sub2prof, blocked);
      evaluate(mutate(c2, groups, subjects, sub2prof, blocked, days, slots, mut_rate), groups, days, slots, sub2prof, blocked);
      newPop.push(c1, c2);
    }
    pop = newPop.slice(0, pop_size);
  }

  pop.sort((a, b) => b.fitness - a.fitness);

  return {
    top: pop.slice(0, 3).map(s => ({
      fitness: s.fitness,
      details: s.details,
      grid: s.grid,
    })),
    best_hist: bestHist,
    avg_hist: avgHist,
  };
}
