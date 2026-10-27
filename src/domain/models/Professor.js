export class Professor {
  constructor(id, name, subject_ids = [], unavailable = []) {
    if (!id || typeof id !== 'string') throw new Error('Professor id is required');
    if (!name || typeof name !== 'string') throw new Error('Professor name is required');
    if (!Array.isArray(subject_ids)) throw new Error('subject_ids must be an array');
    if (!Array.isArray(unavailable)) throw new Error('unavailable must be an array');
    this.id = id;
    this.name = name;
    this.subject_ids = subject_ids;
    this.unavailable = unavailable;
  }
}
