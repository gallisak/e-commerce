import { existsSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { OrderStatus, PrismaClient, Role } from '../generated/prisma/client.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const DEMO_ORDER_COUNT = 80;
const DEMO_ORDER_DAYS = 30;

function createRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATALOG: Record<string, { name: string; products: [string, number, string][] }> = {
  electronics: {
    name: 'Electronics',
    products: [
      ['Nova X Smartphone', 1899900, 'AMOLED 6.5", 128 GB, triple 50 MP camera.'],
      ['AirTone Wireless Earbuds', 299900, 'Active noise cancelling, up to 30 hours of playback.'],
      ['TabOne 11 Tablet', 1249900, '11" display, 8/256 GB, stylus support.'],
      ['Pulse 3 Smartwatch', 549900, 'GPS, heart rate monitor, 5 ATM water resistance.'],
      ['Boom Mini Portable Speaker', 149900, 'Bluetooth 5.3, IP67 protection.'],
      ['20000 mAh Power Bank', 99900, '65 W fast charging, USB-C PD.'],
    ],
  },
  computers: {
    name: 'Computers',
    products: [
      ['ProBook 14 Laptop', 3499900, 'Ryzen 7, 16 GB RAM, 1 TB SSD.'],
      ['KeyMaster Mechanical Keyboard', 349900, 'Hot-swappable switches, RGB backlight.'],
      ['Glide Wireless Mouse', 129900, '26000 DPI sensor, 70 g.'],
      ['View 27 QHD Monitor', 1099900, '27" IPS, 2560x1440, 165 Hz.'],
      ['ClearCam Webcam', 189900, 'Full HD 60 fps, autofocus.'],
      ['1 TB NVMe SSD', 279900, 'PCIe 4.0, up to 7000 MB/s.'],
    ],
  },
  home: {
    name: 'Home & Kitchen',
    products: [
      ['Barista Pro Coffee Machine', 899900, 'Espresso machine, 15 bar pressure, milk frother.'],
      ['Steel Electric Kettle 1.7 L', 89900, 'Stainless steel, keep-warm function.'],
      ['PowerMix Blender', 249900, '1200 W, 1.5 L glass jar.'],
      ['CleanBot Robot Vacuum', 1399900, 'Lidar navigation, wet mopping.'],
      ['ChefLine Knife Set', 199900, '5 knives with a bamboo block.'],
      ['Crispy Air Fryer 5 L', 349900, '8 presets, non-stick coating.'],
    ],
  },
  sports: {
    name: 'Sports',
    products: [
      ['Balance Yoga Mat', 79900, '6 mm TPE, non-slip surface.'],
      ['Adjustable Dumbbells 2x10 kg', 239900, 'Chrome handles, carrying case.'],
      ['Move Fitness Band', 169900, 'Step counter, sleep tracking, 14-day battery life.'],
      ['Pro Match Football', 119900, 'Size 5, thermo-bonded panels.'],
      ['Speed Jump Rope', 34900, 'Steel cable, ball bearings.'],
      ['Sports Bottle 750 ml', 29900, 'Tritan, BPA-free.'],
    ],
  },
  books: {
    name: 'Books',
    products: [
      ['Clean Code', 59900, 'Robert C. Martin. A classic on code quality.'],
      ['Designing Data-Intensive Applications', 89900, 'Martin Kleppmann. Distributed systems.'],
      ['Refactoring', 69900, 'Martin Fowler. Improving the design of existing code.'],
      ['Design Patterns', 64900, 'Gang of Four. Elements of reusable object-oriented software.'],
      ['The Pragmatic Programmer', 54900, 'Hunt and Thomas. Your journey to mastery.'],
      ['Effective TypeScript', 49900, 'Dan Vanderkam. Specific ways to improve your TypeScript.'],
    ],
  },
  clothing: {
    name: 'Clothing',
    products: [
      ['Basic Oversize Hoodie', 129900, '100% cotton, unisex.'],
      ['Essential T-Shirt', 49900, 'Organic cotton, 180 gsm.'],
      ['Run Light Sneakers', 349900, 'Lightweight foam, mesh upper.'],
      ['Windbreaker Jacket', 249900, 'Wind- and water-repellent.'],
      ['Urban Backpack 25 L', 179900, 'Fits a 15.6" laptop.'],
      ['Ribbed Beanie', 39900, 'Merino wool.'],
    ],
  },
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env variable ${name}`);
  return value;
}

async function seedUsers(prisma: PrismaClient) {
  const accounts = [
    {
      email: requireEnv('SEED_ADMIN_EMAIL'),
      password: requireEnv('SEED_ADMIN_PASSWORD'),
      name: 'Admin',
      role: Role.ADMIN,
    },
    {
      email: requireEnv('SEED_CUSTOMER_EMAIL'),
      password: requireEnv('SEED_CUSTOMER_PASSWORD'),
      name: 'Demo Customer',
      role: Role.CUSTOMER,
    },
  ];

  const users = [];
  for (const { password, ...account } of accounts) {
    const existing = await prisma.user.findUnique({ where: { email: account.email } });
    users.push(
      existing ??
        (await prisma.user.create({
          data: { ...account, passwordHash: await argon2.hash(password) },
        })),
    );
  }
  return { admin: users[0], customer: users[1] };
}

async function seedCatalog(prisma: PrismaClient, random: () => number) {
  const categories = await Promise.all(
    Object.entries(CATALOG).map(([slug, { name }]) =>
      prisma.category.upsert({ where: { slug }, update: {}, create: { slug, name } }),
    ),
  );

  if ((await prisma.product.count()) > 0) return;

  const now = Date.now();
  await prisma.product.createMany({
    data: categories.flatMap((category) =>
      CATALOG[category.slug].products.map(([name, price, description], index) => ({
        name,
        description,
        price,
        stock: 5 + Math.floor(random() * 60),
        imageUrl: `https://picsum.photos/seed/${category.slug}-${index}/600/600`,
        categoryId: category.id,
        createdAt: new Date(now - Math.floor(random() * 60) * 86_400_000),
      })),
    ),
  });
}

async function seedDemoOrders(prisma: PrismaClient, customerId: string, random: () => number) {
  if ((await prisma.order.count()) > 0) return;

  const products = await prisma.product.findMany({ select: { id: true, name: true, price: true } });
  const statusPool: OrderStatus[] = [
    ...Array<OrderStatus>(7).fill(OrderStatus.COMPLETED),
    OrderStatus.SHIPPED,
    OrderStatus.PROCESSING,
    OrderStatus.CANCELLED,
  ];
  const path: OrderStatus[] = [
    OrderStatus.NEW,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.COMPLETED,
  ];

  for (let i = 0; i < DEMO_ORDER_COUNT; i++) {
    const createdAt = new Date(Date.now() - random() * DEMO_ORDER_DAYS * 86_400_000);
    const picked = [...products].sort(() => random() - 0.5).slice(0, 1 + Math.floor(random() * 3));
    const items = picked.map((p) => ({
      productId: p.id,
      productName: p.name,
      unitPrice: p.price,
      quantity: 1 + Math.floor(random() * 3),
    }));
    const status = statusPool[Math.floor(random() * statusPool.length)];
    const transitions =
      status === OrderStatus.CANCELLED
        ? [OrderStatus.NEW, OrderStatus.CANCELLED]
        : path.slice(0, path.indexOf(status) + 1);

    await prisma.order.create({
      data: {
        userId: customerId,
        status,
        totalAmount: items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
        shippingAddress: '1 Khreshchatyk St, Kyiv',
        cancelReason: status === OrderStatus.CANCELLED ? 'Cancelled by customer' : null,
        createdAt,
        updatedAt: createdAt,
        items: { create: items },
        statusHistory: {
          create: transitions.map((toStatus, step) => ({
            fromStatus: step === 0 ? null : transitions[step - 1],
            toStatus,
            createdAt: new Date(createdAt.getTime() + step * 3_600_000),
          })),
        },
      },
    });
  }
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requireEnv('DATABASE_URL') }),
  });
  const random = createRandom(42);

  try {
    const { customer } = await seedUsers(prisma);
    await seedCatalog(prisma, random);
    await seedDemoOrders(prisma, customer.id, random);

    const [users, categories, products, orders] = await Promise.all([
      prisma.user.count(),
      prisma.category.count(),
      prisma.product.count(),
      prisma.order.count(),
    ]);
    console.log(
      `Seed done: ${users} users, ${categories} categories, ${products} products, ${orders} orders`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

await main();
