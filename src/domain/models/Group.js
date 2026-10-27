export class Group {
  constructor(id, name, subject_ids = [], semester = 1) {
    if (!id || typeof id !== 'string') throw new Error('Group id is required');
    if (!name || typeof name !== 'string') throw new Error('Group name is required');
    if (!Array.isArray(subject_ids)) throw new Error('subject_ids must be an array');
    this.id = id;
    this.name = name;
    this.subject_ids = subject_ids;
    this.semester = semester;
  }
}
