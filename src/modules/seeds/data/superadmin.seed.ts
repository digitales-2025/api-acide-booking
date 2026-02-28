import { UserRolType } from '@prisma/client';

export const superAdminSeed = {
  name: 'Super Admin',
  email: 'admin@hotelprototype.com',
  password: 'HotelPrototype2025!1',
  phone: '+51955888888',
  mustChangePassword: false,
  userRol: UserRolType.ADMIN,
};
