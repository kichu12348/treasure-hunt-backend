import { Hono } from "hono";
import { cors } from "hono/cors";
import type { D1Database } from "@cloudflare/workers-types";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors({ origin: "*" }));

type Env = {
  DB: D1Database;
};

const schema = `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP);`;

app.get("/", (c) => {
  return c.text(
    "Hello World! dis is kichu from tressure-backend hehehe im everywhere because of this edge network"
  );
});

app.post("/submit", async (c) => {
  const { name, email } = (await c.req.json()) as {
    name: string;
    email: string;
  };
  if (!name || !email) {
    return c.json({ error: "Name and email are required." }, 400);
  }

  try {
    const db = c.env.DB;
    const isFirst = await db.prepare("SELECT * FROM users LIMIT 1").first();

    if (!isFirst) {
      await db
        .prepare("INSERT INTO users (name, email) VALUES (?, ?)")
        .bind(name, email)
        .run();
      return c.json({ isFirst: true, position: 1 }, 201);
    }
    const existingUser = await db
      .prepare("SELECT * FROM users WHERE email = ?")
      .bind(email)
      .first();
    if (existingUser) {
      return c.json(
        { error: "There is already a submission with this email." },
        400
      );
    }
    await db
      .prepare("INSERT INTO users (name, email) VALUES (?, ?)")
      .bind(name, email)
      .run();
    const position = await db
      .prepare(
        "SELECT id FROM users WHERE email = ?"
      )
      .bind(email)
      .first();
    return c.json(
      {
        isFirst: false,
        position: position ? (position.id as number) : 1,
      },
      201
    );
  } catch (error) {
    console.log(
      "Error inserting user:",
      error instanceof Error ? error.message : String(error)
    );
    return c.json(
      {
        error:
          "Internal server error: " +
          (error instanceof Error ? error.message : String(error)),
      },
      500
    );
  }
});

app.get("/users", async (c) => {
  try {
    const db = c.env.DB;
    const result = await db.prepare("SELECT * FROM users").all();
    return c.json(result.results);
  } catch (error) {
    console.error("Error fetching users:", error);
    return c.json(
      { error: "Internal server error: " + (error as Error).message },
      500
    );
  }
});

app.get("/users/:email", async (c) => {
  const email = c.req.param("email");
  if (!email) {
    return c.json({ error: "Email is required." }, 400);
  }
  try {
    const db = c.env.DB;
    const user = await db
      .prepare("SELECT * FROM users WHERE email = ?")
      .bind(email)
      .first();
    if (!user) {
      return c.json({ error: "User not found." }, 404);
    }
    return c.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return c.json(
      { error: "Internal server error: " + (error as Error).message },
      500
    );
  }
});

app.get("/init-db", async (c) => {
  try {
    const db = c.env.DB;
    await db.exec(schema);
    await db.prepare("DROP TABLE IF EXISTS users").run(); // Clear existing data
    await db.exec(schema); // Recreate the table
    return c.json({
      message: "Database initialized successfully and cleared all data",
    });
  } catch (error) {
    console.error("Error initializing database:", error);
    return c.json(
      { error: "Internal server error: " + (error as Error).message },
      500
    );
  }
});

app.get("/winner", async (c) => {
  try {
    const db = c.env.DB;
    const winner = await db
      .prepare("SELECT * FROM users ORDER BY timestamp ASC LIMIT 1")
      .first();
    if (!winner) {
      return c.json({ error: "No submissions found." }, 404);
    }
    return c.json(winner);
  } catch (error) {
    console.error("Error fetching winner:", error);
    return c.json(
      { error: "Internal server error: " + (error as Error).message },
      500
    );
  }
});

export default app;
