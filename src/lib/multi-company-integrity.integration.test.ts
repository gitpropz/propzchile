import { before, after, test } from "node:test";
import { strictEqual, deepStrictEqual, rejects } from "node:assert";
import { readFileSync } from "node:fs";
import postgres from "postgres";

// Only run against a disposable database. Never point this suite at a hosted portfolio.
const enabled = process.env.PROPZ_INTEGRITY_DISPOSABLE_DB === "yes";
const db = postgres({ host: "127.0.0.1", port: 55432, database: "postgres", username: "integrity_test", ssl: false, max: 1 });
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const orgA = id(1), orgB = id(2);
const relations = [
  ["rentable_units", "property_id", 20, 11],
  ["rent_payments", "property_id", 40, 11],
  ["rent_payments", "unit_id", 40, 21],
  ["bank_transactions", "import_id", 50, 31],
  ["bank_transactions", "matched_unit_id", 50, 21],
  ["rent_payment_allocations", "rent_payment_id", 80, 41],
  ["rent_payment_allocations", "bank_transaction_id", 80, 51],
  ["monitored_services", "property_id", 60, 11],
  ["monitored_services", "unit_id", 60, 21],
  ["service_readings", "service_id", 70, 61],
  ["service_readings", "property_id", 70, 11],
] as const;

before(async () => {
  if (!enabled) return;
  await db.unsafe(`
    CREATE TABLE public.properties(id uuid PRIMARY KEY, organization_id uuid NOT NULL);
    CREATE TABLE public.rentable_units(id uuid PRIMARY KEY, organization_id uuid NOT NULL, property_id uuid NOT NULL REFERENCES public.properties ON DELETE CASCADE);
    CREATE TABLE public.bank_statement_imports(id uuid PRIMARY KEY, organization_id uuid NOT NULL);
    CREATE TABLE public.rent_payments(id uuid PRIMARY KEY, organization_id uuid NOT NULL, property_id uuid NOT NULL REFERENCES public.properties ON DELETE CASCADE, unit_id uuid NOT NULL REFERENCES public.rentable_units ON DELETE CASCADE, amount numeric(14,2) NOT NULL DEFAULT 100, amount_paid numeric(14,2) NOT NULL DEFAULT 0, paid_date date, status text NOT NULL DEFAULT 'pending', confirmed_at timestamptz);
    CREATE TABLE public.bank_transactions(id uuid PRIMARY KEY, organization_id uuid NOT NULL, import_id uuid REFERENCES public.bank_statement_imports ON DELETE SET NULL, matched_unit_id uuid REFERENCES public.rentable_units ON DELETE SET NULL);
    CREATE TABLE public.monitored_services(id uuid PRIMARY KEY, organization_id uuid NOT NULL, property_id uuid REFERENCES public.properties ON DELETE CASCADE, unit_id uuid REFERENCES public.rentable_units ON DELETE CASCADE);
    CREATE TABLE public.service_readings(id uuid PRIMARY KEY, organization_id uuid NOT NULL, property_id uuid NOT NULL REFERENCES public.properties ON DELETE CASCADE, service_id uuid NOT NULL REFERENCES public.monitored_services ON DELETE CASCADE);
    CREATE TABLE public.rent_payment_allocations(id uuid PRIMARY KEY, organization_id uuid NOT NULL, rent_payment_id uuid NOT NULL REFERENCES public.rent_payments ON DELETE CASCADE, bank_transaction_id uuid REFERENCES public.bank_transactions ON DELETE SET NULL, amount numeric(14,2) NOT NULL DEFAULT 25, paid_date date NOT NULL DEFAULT '2026-11-15');
    INSERT INTO public.properties VALUES ('${id(10)}','${orgA}'),('${id(11)}','${orgB}');
    INSERT INTO public.rentable_units VALUES ('${id(20)}','${orgA}','${id(10)}'),('${id(21)}','${orgB}','${id(11)}');
    INSERT INTO public.bank_statement_imports VALUES ('${id(30)}','${orgA}'),('${id(31)}','${orgB}');
    INSERT INTO public.rent_payments(id,organization_id,property_id,unit_id) VALUES ('${id(40)}','${orgA}','${id(10)}','${id(20)}'),('${id(41)}','${orgB}','${id(11)}','${id(21)}'),('${id(42)}','${orgA}','${id(10)}','${id(20)}');
    INSERT INTO public.bank_transactions VALUES ('${id(50)}','${orgA}','${id(30)}','${id(20)}'),('${id(51)}','${orgB}','${id(31)}','${id(21)}');
    INSERT INTO public.monitored_services VALUES ('${id(60)}','${orgA}','${id(10)}','${id(20)}'),('${id(61)}','${orgB}','${id(11)}','${id(21)}');
    INSERT INTO public.service_readings VALUES ('${id(70)}','${orgA}','${id(10)}','${id(60)}'),('${id(71)}','${orgB}','${id(11)}','${id(61)}');
    INSERT INTO public.rent_payment_allocations(id,organization_id,rent_payment_id,bank_transaction_id) VALUES ('${id(80)}','${orgA}','${id(40)}','${id(50)}');
  `);
  const migrationPath = process.env.PROPZ_INTEGRITY_MIGRATION;
  if (!migrationPath) throw new Error("Set the path to the exact integrity migration");
  await db.unsafe(readFileSync(migrationPath, "utf8"));
  await db.unsafe("CREATE TRIGGER trg_rent_alloc_recompute AFTER INSERT OR UPDATE OR DELETE ON public.rent_payment_allocations FOR EACH ROW EXECUTE FUNCTION public.recompute_rent_payment_totals()");
});
after(async () => { await db.end(); });

for (const [table, column, row, foreignRow] of relations) {
  test(`${table}.${column} rejects a foreign organization on UPDATE`, { skip: !enabled }, async () => {
    await rejects(db.unsafe(`UPDATE public.${table} SET ${column} = '${id(foreignRow)}' WHERE id = '${id(row)}'`), { code: "23503" });
  });
  test(`${table}.${column} rejects a foreign organization on INSERT`, { skip: !enabled }, async () => {
    await rejects(db.unsafe(`INSERT INTO public.${table} SELECT (jsonb_populate_record(NULL::public.${table}, to_jsonb(t) || jsonb_build_object('id','${id(999)}','${column}','${id(foreignRow)}'))).* FROM public.${table} t WHERE id = '${id(row)}'`), { code: "23503" });
  });
}

for (const [table, row] of [["properties",10],["rentable_units",20],["bank_statement_imports",30],["bank_transactions",50],["rent_payments",40],["monitored_services",60]] as const) {
  test(`${table} cannot move to another organization while referenced`, { skip: !enabled }, async () => {
    await rejects(db.unsafe(`UPDATE public.${table} SET organization_id = '${orgB}' WHERE id = '${id(row)}'`), { code: "23503" });
  });
}

const rolledBack = new Error("rollback isolated test");
async function isolated(fn: (tx: postgres.TransactionSql) => Promise<void>) {
  try { await db.begin(async tx => { await fn(tx); throw rolledBack; }); }
  catch (error) { if (error !== rolledBack) throw error; }
}

test("optional links accept NULL without clearing organization", { skip: !enabled }, async () => {
  await isolated(async tx => {
    await tx.unsafe(`UPDATE public.bank_transactions SET import_id=NULL,matched_unit_id=NULL WHERE id='${id(50)}'; UPDATE public.rent_payment_allocations SET bank_transaction_id=NULL WHERE id='${id(80)}'; UPDATE public.monitored_services SET property_id=NULL,unit_id=NULL WHERE id='${id(60)}'`);
    const rows = await tx.unsafe(`SELECT organization_id FROM public.bank_transactions WHERE id='${id(50)}'`);
    strictEqual(rows[0].organization_id, orgA);
  });
});

for (const [parent, parentId, child, childId, column] of [
  ["bank_statement_imports",30,"bank_transactions",50,"import_id"],
  ["rentable_units",20,"bank_transactions",50,"matched_unit_id"],
  ["bank_transactions",50,"rent_payment_allocations",80,"bank_transaction_id"],
] as const) {
  test(`${parent} deletion preserves SET NULL semantics and child organization`, { skip: !enabled }, async () => {
    await isolated(async tx => {
      // The unit also owns the fixture payment; unlink this transaction from its allocation for this deletion test.
      if (parent === "rentable_units") await tx.unsafe(`UPDATE public.rent_payment_allocations SET bank_transaction_id=NULL WHERE id='${id(80)}'`);
      await tx.unsafe(`DELETE FROM public.${parent} WHERE id='${id(parentId)}'`);
      const rows = await tx.unsafe(`SELECT ${column},organization_id FROM public.${child} WHERE id='${id(childId)}'`);
      strictEqual(rows.length, 1);
      strictEqual(rows[0][column], null);
      strictEqual(rows[0].organization_id, orgA);
    });
  });
}

test("recomputation preserves totals and status on insert, update and delete", { skip: !enabled }, async () => {
  await isolated(async tx => {
    await tx.unsafe(`INSERT INTO public.rent_payment_allocations(id,organization_id,rent_payment_id,amount) VALUES('${id(81)}','${orgA}','${id(40)}',75)`);
    let rows = await tx.unsafe(`SELECT amount_paid,status FROM public.rent_payments WHERE id='${id(40)}'`);
    deepStrictEqual([Number(rows[0].amount_paid),rows[0].status], [100,"confirmed"]);
    await tx.unsafe(`UPDATE public.rent_payment_allocations SET amount=5 WHERE id='${id(81)}'`);
    rows = await tx.unsafe(`SELECT amount_paid,status FROM public.rent_payments WHERE id='${id(40)}'`);
    deepStrictEqual([Number(rows[0].amount_paid),rows[0].status], [30,"partial"]);
    await tx.unsafe(`DELETE FROM public.rent_payment_allocations WHERE rent_payment_id='${id(40)}'`);
    rows = await tx.unsafe(`SELECT amount_paid,status,paid_date,confirmed_at FROM public.rent_payments WHERE id='${id(40)}'`);
    deepStrictEqual([Number(rows[0].amount_paid),rows[0].status,rows[0].paid_date,rows[0].confirmed_at], [0,"pending",null,null]);
  });
});

test("moving an allocation recomputes old and new payments", { skip: !enabled }, async () => {
  await isolated(async tx => {
    await tx.unsafe(`UPDATE public.rent_payment_allocations SET rent_payment_id='${id(42)}' WHERE id='${id(80)}'`);
    const rows = await tx.unsafe(`SELECT amount_paid,status FROM public.rent_payments WHERE id IN ('${id(40)}','${id(42)}') ORDER BY id`);
    deepStrictEqual(rows.map(r => [Number(r.amount_paid),r.status]), [[0,"pending"],[25,"partial"]]);
  });
});

test("recomputation independently rejects foreign organizations even with FK triggers disabled", { skip: !enabled }, async () => {
  // Privileged bypass is restricted to the disposable fixture and rolled back even on failure.
  await rejects(isolated(async tx => {
    await tx.unsafe(`ALTER TABLE public.rent_payment_allocations DISABLE TRIGGER ALL; INSERT INTO public.rent_payment_allocations(id,organization_id,rent_payment_id) VALUES('${id(82)}','${orgB}','${id(40)}'); ALTER TABLE public.rent_payment_allocations ENABLE TRIGGER trg_rent_alloc_recompute; UPDATE public.rent_payment_allocations SET amount=26 WHERE id='${id(82)}'`);
  }), { code: "23503", message: "Allocation and payment organizations must match" });
});

test("recomputation rejects a preexisting foreign allocation rather than counting it", { skip: !enabled }, async () => {
  await rejects(isolated(async tx => {
    await tx.unsafe(`ALTER TABLE public.rent_payment_allocations DISABLE TRIGGER ALL; INSERT INTO public.rent_payment_allocations(id,organization_id,rent_payment_id) VALUES('${id(82)}','${orgB}','${id(40)}'); ALTER TABLE public.rent_payment_allocations ENABLE TRIGGER trg_rent_alloc_recompute; UPDATE public.rent_payment_allocations SET amount=26 WHERE id='${id(80)}'`);
  }), { code: "23503", message: "Payment contains an allocation from another organization" });
});

test("deleting a payment still cascades allocations", { skip: !enabled }, async () => {
  await isolated(async tx => {
    await tx.unsafe(`DELETE FROM public.rent_payments WHERE id='${id(40)}'`);
    const rows = await tx.unsafe(`SELECT count(*)::int AS count FROM public.rent_payment_allocations WHERE id='${id(80)}'`);
    strictEqual(rows[0].count, 0);
  });
});