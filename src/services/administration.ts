import { employeeRepository, roleRepository, userRepository } from '../db/repositories/index.js';
import type { Database } from '../db/client.js';

export const listUsers = (database: Database) => userRepository.list(database);
export const findUser = (database: Database, id: string) => userRepository.findById(database, id);
export const listRoles = (database: Database) => roleRepository.list(database);
export const findRoleByName = (database: Database, name: string) => roleRepository.findByName(database, name);
export const listEmployees = (database: Database) => employeeRepository.list(database);
export const findEmployee = (database: Database, id: string) => employeeRepository.findById(database, id);
export const listEmployeeConstancias = (database: Database, employeeId: string) => employeeRepository.constancias(database, employeeId);
