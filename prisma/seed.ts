import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const ukBranches = [
  { key: "london", name: "Steakz London", city: "London", address: "22 Mayfair Lane, London", phone: "+44 20 0000 0101" },
  { key: "manchester", name: "Steakz Manchester", city: "Manchester", address: "18 Deansgate, Manchester", phone: "+44 161 000 0202" },
  { key: "birmingham", name: "Steakz Birmingham", city: "Birmingham", address: "44 Colmore Row, Birmingham", phone: "+44 121 000 0303" },
  { key: "liverpool", name: "Steakz Liverpool", city: "Liverpool", address: "9 Albert Dock, Liverpool", phone: "+44 151 000 0404" },
  { key: "leeds", name: "Steakz Leeds", city: "Leeds", address: "31 Greek Street, Leeds", phone: "+44 113 000 0505" }
];

async function main() {
  await prisma.sale.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.tableBooking.deleteMany();
  await prisma.order.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();

  const passwordHash = await bcrypt.hash("123456", 10);
  const branches = new Map<string, { id: string; name: string; city: string }>();

  for (const branch of ukBranches) {
    const created = await prisma.branch.create({
      data: {
        name: branch.name,
        city: branch.city,
        address: branch.address,
        phone: branch.phone
      }
    });
    branches.set(branch.key, created);
  }

  const admin = await prisma.user.create({
    data: { name: "IT Admin", email: "admin@steakz.test", passwordHash, role: Role.ADMIN }
  });
  await prisma.user.create({
    data: { name: "System Admin", email: "system.admin@steakz.test", passwordHash, role: Role.ADMIN }
  });

  await prisma.user.create({
    data: { name: "UK Country Manager", email: "country@steakz.test", passwordHash, role: Role.HEADQUARTER_MANAGER }
  });

  const branchStaff: Array<{ branchKey: string; managerId: string; chefId: string; waiterId: string; cashierId: string }> = [];

  for (const branch of ukBranches) {
    const branchRecord = branches.get(branch.key)!;
    const manager = await prisma.user.create({
      data: {
        name: `${branch.city} Branch Manager`,
        email: `manager.${branch.key}@steakz.test`,
        passwordHash,
        role: Role.BRANCH_MANAGER,
        branchId: branchRecord.id
      }
    });
    const chef = await prisma.user.create({
      data: {
        name: `${branch.city} Chef`,
        email: `chef.${branch.key}@steakz.test`,
        passwordHash,
        role: Role.CHEF,
        branchId: branchRecord.id
      }
    });
    const waiter = await prisma.user.create({
      data: {
        name: `${branch.city} Waiter`,
        email: `waiter.${branch.key}@steakz.test`,
        passwordHash,
        role: Role.WAITER,
        branchId: branchRecord.id
      }
    });
    const cashier = await prisma.user.create({
      data: {
        name: `${branch.city} Cashier`,
        email: `cashier.${branch.key}@steakz.test`,
        passwordHash,
        role: Role.CASHIER,
        branchId: branchRecord.id
      }
    });

    branchStaff.push({ branchKey: branch.key, managerId: manager.id, chefId: chef.id, waiterId: waiter.id, cashierId: cashier.id });
  }

  await prisma.inventoryItem.createMany({
    data: Array.from(branches.values()).flatMap((branch) => [
      { branchId: branch.id, name: "Ribeye Steak", category: "Meat", quantity: 42, unit: "portions", reorderLevel: 12, supplier: "UK Prime Cuts" },
      { branchId: branch.id, name: "Filet Tenderloin", category: "Meat", quantity: 32, unit: "portions", reorderLevel: 10, supplier: "UK Prime Cuts" },
      { branchId: branch.id, name: "Beef Patties", category: "Meat", quantity: 56, unit: "portions", reorderLevel: 18, supplier: "UK Prime Cuts" },
      { branchId: branch.id, name: "Tomahawk Steak", category: "Meat", quantity: 20, unit: "portions", reorderLevel: 8, supplier: "UK Prime Cuts" },
      { branchId: branch.id, name: "Chicken Fillets", category: "Meat", quantity: 36, unit: "portions", reorderLevel: 12, supplier: "Northern Fresh Foods" },
      { branchId: branch.id, name: "Salmon Fillet", category: "Seafood", quantity: 28, unit: "portions", reorderLevel: 10, supplier: "Coastal Fresh Fish" },
      { branchId: branch.id, name: "Potatoes", category: "Vegetables", quantity: 80, unit: "kg", reorderLevel: 20, supplier: "British Farm Network" },
      { branchId: branch.id, name: "House Salad Mix", category: "Vegetables", quantity: 55, unit: "kg", reorderLevel: 15, supplier: "Yorkshire Produce" }
    ])
  });

  for (const staff of branchStaff) {
    const branch = branches.get(staff.branchKey)!;
    const order = await prisma.order.create({
      data: {
        branchId: branch.id,
        createdById: staff.waiterId,
        tableNumber: 7,
        customerName: `${branch.city} Walk-in`,
        total: 48.5,
        items: {
          create: [
            { name: "Signature Ribeye", quantity: 1, unitPrice: 48, lineTotal: 48 }
          ]
        }
      }
    });

    await prisma.shift.createMany({
      data: [
        { branchId: branch.id, userId: staff.managerId, startsAt: new Date("2026-06-05T08:00:00.000Z"), endsAt: new Date("2026-06-05T16:00:00.000Z") },
        { branchId: branch.id, userId: staff.chefId, startsAt: new Date("2026-06-05T10:00:00.000Z"), endsAt: new Date("2026-06-05T18:00:00.000Z") },
        { branchId: branch.id, userId: staff.waiterId, startsAt: new Date("2026-06-05T12:00:00.000Z"), endsAt: new Date("2026-06-05T20:00:00.000Z") },
        { branchId: branch.id, userId: staff.cashierId, startsAt: new Date("2026-06-05T14:00:00.000Z"), endsAt: new Date("2026-06-05T22:00:00.000Z") }
      ]
    });

    if (staff.branchKey === "london") {
      await prisma.sale.create({
        data: { branchId: branch.id, orderId: order.id, cashierId: staff.waiterId, amount: 48.5, paymentMethod: "Card" }
      });
    }
  }

  console.log(`Seed complete. Admin user: ${admin.email} / 123456`);
  console.log("Country manager: country@steakz.test / 123456");
  console.log("Branch example: manager.london@steakz.test / 123456");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
