import { getDb } from "./db";
import { adminUsers } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function fixAdmin() {
  console.log("Starting admin fix...");
  const db = await getDb();
  if (!db) {
    console.error("Could not connect to database");
    return;
  }

  const username = "yahya1019";
  const hash = await bcrypt.hash("ALC@Admin2026#Secure", 12);

  try {
    // Check if exists
    const existing = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1);
    
    if (existing.length > 0) {
      console.log(`Found user ${username}, updating role and isSuperAdmin...`);
      await db.update(adminUsers)
        .set({ 
          role: "superadmin", 
          isSuperAdmin: 1,
          passwordHash: hash 
        })
        .where(eq(adminUsers.username, username));
      console.log("Update successful.");
    } else {
      console.log(`User ${username} not found, creating...`);
      await db.insert(adminUsers).values({
        username,
        passwordHash: hash,
        role: "superadmin",
        isSuperAdmin: 1
      });
      console.log("Creation successful.");
    }
  } catch (err) {
    console.error("Error fixing admin:", err);
  } finally {
    process.exit(0);
  }
}

fixAdmin();
