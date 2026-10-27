export class Schedule {
  constructor(grid, fitness = 0, details = {}) {
    this.grid = grid;
    this.fitness = fitness;
    this.details = details;
  }
}
