export class Subject {
  constructor(id, name, hours_per_week) {
    if (!id || typeof id !== 'string') throw new Error('Subject id is required');
    if (!name || typeof name !== 'string') throw new Error('Subject name is required');
    if (typeof hours_per_week !== 'number' || hours_per_week <= 0) throw new Error('hours_per_week must be a positive number');
    this.id = id;
    this.name = name;
    this.hours_per_week = hours_per_week;
  }
}
