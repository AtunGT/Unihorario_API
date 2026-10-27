import { AcademicDataPort } from '../ports/in/AcademicDataPort.js';
import { Subject } from '../../domain/models/Subject.js';
import { Professor } from '../../domain/models/Professor.js';
import { Group } from '../../domain/models/Group.js';

export class AcademicDataUseCase extends AcademicDataPort {
  constructor({ academicRepository }) {
    super();
    this.academicRepository = academicRepository;
  }

  async getSubjects() {
    return await this.academicRepository.getEntities('subjects');
  }

  async saveSubjects(rawItems) {
    const list = Array.isArray(rawItems) ? rawItems : [rawItems];
    if (!list.length) throw new Error('Array cannot be empty');
    const validated = list.map(item => new Subject(item.id, item.name, item.hours_per_week));
    return await this.academicRepository.saveEntities('subjects', validated);
  }

  async getProfessors() {
    return await this.academicRepository.getEntities('professors');
  }

  async saveProfessors(rawItems) {
    const list = Array.isArray(rawItems) ? rawItems : [rawItems];
    if (!list.length) throw new Error('Array cannot be empty');
    const validated = list.map(item => new Professor(item.id, item.name, item.subject_ids, item.unavailable || []));
    return await this.academicRepository.saveEntities('professors', validated);
  }

  async getGroups() {
    return await this.academicRepository.getEntities('groups');
  }

  async saveGroups(rawItems) {
    const list = Array.isArray(rawItems) ? rawItems : [rawItems];
    if (!list.length) throw new Error('Array cannot be empty');
    const validated = list.map(item => new Group(item.id, item.name, item.subject_ids, item.semester || 1));
    return await this.academicRepository.saveEntities('groups', validated);
  }
}
