import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, type User } from '../generated/prisma/client.js';
import { UsersRepository } from './users.repository.js';

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
  role?: Role;
}

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async getById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(input: CreateUserInput): Promise<User> {
    try {
      return await this.usersRepository.create({ ...input, role: input.role ?? Role.CUSTOMER });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }
}
